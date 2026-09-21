# xrpl.js MPT API audit

Audit of the `xrpl` package (this checkout, 5.2.0 at `f79b82c9`) as seen by a TypeScript developer
issuing and operating a **compliance-grade Multi-Purpose Token**: clawback, pre-emptive address
bans, freeze-on-ban, and a global freeze. The instrument is a runnable project,
[`mpt-issuer/`](mpt-issuer/), that does all of that against a local standalone rippled using this
checkout's build of `xrpl`; every rough edge hit on the way is a numbered finding in this directory.

## Executive summary

- **80 findings**: 2 blockers, 17 major, 46 minor, 15 paper-cuts (table below). Round 1 (building
  the issuer) produced 42; round 2 (five adversarial sweeps, every candidate re-verified on the
  ledger or against the built package) produced 38 more.
- **Two blockers put a different transaction on the wire than the developer wrote, with no error
  from any layer**: the binary codec encodes an MPT `value` of 2^64 + 5 as **5**
  ([022](022-binary-codec-silently-truncates-mpt-values-above-2-64.md)), and a lowercase field name
  such as `holder` is silently dropped when signing, so a per-holder lock becomes a **global freeze
  of every holder** ([061](061-lowercase-field-names-silently-dropped-when-signing.md)). Both fixes
  are a few lines.
- **`submitAndWait` can report a validated transaction as expired** ("Preliminary result:
  tesSUCCESS") because it checks `LastLedgerSequence` before its final `tx` lookup
  ([062](062-submitandwait-expiry-check-precedes-final-tx-lookup.md), reproduced live); an operator
  who retries claws back twice.
- **The two "balances" helpers do not know MPTs exist**: `getBalances` returns only XRP for a holder
  with 100 units ([077](077-getbalances-omits-mpt-holdings.md)) and `getBalanceChanges` reports only
  the XRP fee for an MPT payment or clawback ([053](053-getbalancechanges-ignores-mpt-nodes.md)).
- **The four captain's requirements are achievable, with one honest caveat**: "pre-emptively ban an
  address" has no on-ledger representation. The closest model (allow-listing + never authorize +
  lock-on-arrival + lock-and-clawback for current holders) is implemented in `mpt-issuer/src/ban.ts`
  and proven in the scenario; the limits are in [028](028-pre-emptive-ban-not-expressible-on-ledger.md).
- **The scenario is green**: `npm run scenario` → 63/63 assertions pass on rippled 3.4.0-rc1
  (`rippleci/xrpld:develop`).
- **The type-level seeds from the captain's notes all reproduce** ([001](001-submitandwait-meta-string-undefined.md)–[005](005-ledger-entry-response-never-narrows-node.md)),
  and they compound: because [006](006-mptoken-missing-from-ledgerentry-union.md) leaves `MPToken`
  out of the `LedgerEntry` union, the holder-side read path is unreachable without `as unknown as`,
  which the repo's own tests acknowledge with `@ts-expect-error`.
- **Client-side validation is thin exactly where MPTs are new, and over-strict twice**: `validate()`
  accepts every malformed MPT amount, unknown flag bit, odd-length hex and any string as an ID
  ([016](016-mpt-amount-value-not-validated-no-scale-helper.md), [037](037-mpt-validators-do-not-check-flag-masks.md),
  [070](070-odd-length-hex-truncated-on-signed-path.md), [036](036-mptokenissuanceid-format-not-validated.md)),
  while rejecting the zero `DomainID` that clears a domain
  ([038](038-isdomainid-rejects-zero-hash-that-clears-domain.md)) and credential URIs over 128 bytes
  that rippled accepts up to 256 ([071](071-credentialcreate-uri-capped-at-half-rippled-limit.md)).
- **Every forced cast, `!`, or `@ts-expect-error` in `mpt-issuer/` is tagged `AUDIT-NNN`** in a
  comment; `grep -rn AUDIT- mpt-issuer/src` lists them.

## Design mapping: requirement → ledger mechanism → xrpl.js calls

| Requirement | Ledger mechanism | xrpl.js | Achievable as stated? |
| --- | --- | --- | --- |
| 1. Clawback | `MPTokenIssuanceCreate` with `tfMPTCanClawback`; `Clawback { Amount: { mpt_issuance_id, value }, Holder }` | `mpt-issuer/src/ban.ts` `clawbackTx`, `clawback.ts` | **Yes.** Works while the holder is locked, unauthorized, and during a global freeze; claws back `min(value, balance)`; empty holder → `tecINSUFFICIENT_FUNDS`; no MPToken → `tecOBJECT_NOT_FOUND`. |
| 2. Pre-emptive ban | `tfMPTRequireAuth` (allow-list). A never-authorized address cannot receive (`tecNO_AUTH`). **Nothing can be written on-ledger for an address that has not opted in** (`MPTokenAuthorize`/`MPTokenIssuanceSet` with `Holder` → `tecOBJECT_NOT_FOUND`), and opt-in cannot be prevented. | `ban.ts` `banAddress` (local registry) + `authorizeUnlessBanned` (guard) + `sweepBanned` (lock-on-arrival) | **Not as stated.** Closest: off-ledger registry + refuse to authorize + lock the empty MPToken the moment it appears. rippled cannot enumerate holders (`mpt_holders` is Clio-only), so the sweep polls `ledger_entry` per banned address. Alternative: permissioned-domain admission (`DomainID` + credentials), where "ban" = never issue / revoke the credential (`CredentialDelete` blocks send and receive but leaves the balance); still not pre-emptive, cannot be combined with `Holder`. See [028](028-pre-emptive-ban-not-expressible-on-ledger.md). |
| 3. Freeze newly banned accounts | `MPTokenIssuanceSet { Holder, Flags: tfMPTLock }` sets `lsfMPTLocked` on the holder's `MPToken`. Requires `tfMPTCanLock` on the issuance. | `freeze.ts` `holderLock`, used by `ban.ts` | **Yes**, once the MPToken exists. Lock works on a zero-balance unauthorized entry, survives a later (mistaken) authorization (`tecLOCKED` beats auth), blocks holder↔holder both ways. Caveats: issuer↔holder payments are still allowed under a per-holder lock; a locked holder can never delete its entry. Clawback is unaffected, so "ban" = lock + clawback in one call. |
| 4. Global freeze | `MPTokenIssuanceSet { Flags: tfMPTLock }` (no `Holder`) sets `lsfMPTLocked` on the `MPTokenIssuance`; `tfMPTUnlock` clears it. | `freeze.ts` `globalLock`/`globalUnlock`; verified via `parseMPTokenIssuanceFlags` | **Yes**, with the same exemption: holder↔holder payments fail with `tecLOCKED`, but the issuer can still pay holders and holders can still redeem to the issuer. Idempotent. Per-holder locks are independent bits and survive a global unlock. |

Immutability: the issuer pins `ImmutableFlags = tifMPTCanTrade | tifMPTCanEscrow |
tifMPTCanHoldConfidentialBalance` (capabilities that must never be switched on later; `tfMPTSet*`
are one-way *on*, so this is the only way to promise holders the token will not become
tradable/escrowable/confidential) plus the three safety flags for documentation value. Verified:
`tfMPTSetCanTrade` on the pinned issuance → `tecNO_PERMISSION`. (MPT trading is `temDISABLED` on
this rippled anyway, [052](052-cantrade-docs-promise-dex-amm-the-sdk-cannot-express.md).)

## Local rippled recipe (what actually works)

The integration README's recipe (`rippleci/rippled:2.3.0-rc1`, `/etc/opt/ripple/`) predates the
MPT amendments and the `xrpld` rename ([019](019-integration-test-docs-stale.md)). CI's recipe is:

```sh
docker pull rippleci/xrpld:develop            # this audit: 3.4.0-rc1, digest sha256:898feb09…
docker run --detach --publish 6006:6006 \
  --volume "$PWD/.ci-config/:/etc/xrpld/" \
  --name xrpld-service rippleci/xrpld:develop --standalone
```

Notes:

- The image is `linux/amd64`; on Apple Silicon it runs under emulation (OrbStack/Rosetta) and is
  fine for this workload.
- `--standalone` alone does **not** seed the Amendments ledger object. The `[features]` stanza in
  `.ci-config/xrpld.cfg` is applied as *rule presets*: transactions behave as if the amendments
  are enabled, but the `feature` RPC reports every one of them as `enabled: false, vetoed: true`
  ([020](020-feature-rpc-misreports-standalone-presets.md)). Do not gate anything on `feature`.
  Verify behaviourally instead: `npm run check-amendments` in `mpt-issuer/` simulates a gated
  transaction per amendment and reports `temDISABLED` vs anything else. On this image all of
  `MPTokensV1`, `DynamicMPT`, `Clawback`, `PermissionedDomains`, `Credentials`, `TokenEscrow` are
  in effect.
- Ledgers do not close by themselves; the project runs `ledger_accept` every 400 ms
  (`mpt-issuer/src/session.ts`) so that the real `submitAndWait` path is exercised. That cadence is
  also what exposes [062](062-submitandwait-expiry-check-precedes-final-tx-lookup.md).
- The stanza omits 11 amendments the image supports, notably `fixMPTDeliveredAmount`
  ([021](021-ci-xrpld-cfg-missing-newer-amendments.md)); tests run without them.
- Sanity check before writing code: the repo's own
  `packages/xrpl/test/integration/transactions/mptokenIssuanceSet.test.ts` (`-t base`) passes
  against this node.

## How to run the issuer project

```sh
npm ci && npm run build                         # repo root; produces packages/xrpl/dist
cd audit/mpt-issuer && npm install              # links xrpl -> ../../packages/xrpl (file:)
npm run typecheck                               # strict tsc over src/ (no any, every cast tagged)
npm run type-repros                             # compiles src/type-repros/repros.ts: passes only while the type findings exist
npm run check-amendments                        # behavioural amendment probe
npm run scenario                                # the end-to-end lifecycle, prints a PASS/FAIL table, exit 1 on any failure
npm run issue | holders | ban | freeze | clawback | domain | probes   # individual modules
npm run inspect -- <MPTokenIssuanceID> [holder] # read-side helpers, keylet derivation, mpt_holders attempt
```

`XRPL_URL` (default `ws://localhost:6006`) and `LEDGER_TICK_MS` are configurable. The scenario
prints the realpath `xrpl` resolves to (`packages/xrpl/dist/npm/index.js`) as proof that the local
build is what runs; `node_modules/xrpl` is a symlink to `../../packages/xrpl`. Modules fund wallets
from the genesis account and must run one at a time.

`npm run probes` prints, for ~50 deliberately malformed MPT transactions, what the SDK's
`validate()` says next to what rippled's `simulate` says; rows marked `<-- SDK could catch` are the
validator gaps.

## Findings

Severity: blocker / major / minor / paper-cut. Fix size: S = docs or a few lines; M = a type or
validator change with tests; L = structural (new helper module, breaking type change).

| id | title | severity | category | fix |
| --- | --- | --- | --- | --- |
| [001](001-submitandwait-meta-string-undefined.md) | `submitAndWait` meta typed `\| string \| undefined` though unreachable | major | types | M |
| [002](002-wallet-sign-erases-transaction-type.md) | `Wallet.sign()` not generic; blob loses its type | major | types | M |
| [003](003-transaction-literals-widen-no-factory.md) | Transaction literals widen; no typed factory | minor | missing-helper | S |
| [004](004-basetransaction-record-string-unknown-collapses-keyof.md) | `BaseTransaction extends Record<string, unknown>` collapses keyof, defeats excess-property checks | major | types | L |
| [005](005-ledger-entry-response-never-narrows-node.md) | `ledger_entry` never narrows `node` | major | rpc | M |
| [006](006-mptoken-missing-from-ledgerentry-union.md) | `MPToken` missing from `LedgerEntry` union | major | types | S |
| [007](007-account-objects-type-filter-does-not-narrow.md) | `account_objects` type filter does not narrow | minor | rpc | M |
| [008](008-mptokenissuanceset-docs-incomplete.md) | `MPTokenIssuanceSet` docs incomplete; one-way flags undocumented on members | paper-cut | docs | S |
| [009](009-mptoken-flags-no-enum-or-parser.md) | `MPToken.Flags` has no enum/parser (`lsfMPTLocked`, `lsfMPTAuthorized`) | minor | missing-helper | S |
| [010](010-mptoken-ledger-type-mismatches-rippled-json.md) | `MPToken` type: no `Account`, `MPTAmount` wrongly required | major | types | S |
| [011](011-mptokenissuance-type-lacks-mpt-issuance-id.md) | `MPTokenIssuance` type lacks injected `mpt_issuance_id` | minor | rpc | S |
| [012](012-no-helper-to-derive-mpt-issuance-id-or-keylets.md) | No helper to derive `MPTokenIssuanceID` or MPT keylets; meta field optional | major | missing-helper | M |
| [013](013-mptokenauthorize-docs-copy-pasted.md) | `MPTokenAuthorize` docs copy-pasted from `MPTokenIssuanceSet` | minor | docs | S |
| [014](014-validatemptokenauthorize-enforces-nothing.md) | `validateMPTokenAuthorize` checks types only | minor | validation | M |
| [015](015-mpt-holders-request-untyped.md) | `mpt_holders` untyped; no note that rippled cannot enumerate holders | minor | rpc | M |
| [016](016-mpt-amount-value-not-validated-no-scale-helper.md) | `MPTAmount.value` never validated; three failure layers; no scale helper | major | validation | M |
| [017](017-amount-type-excludes-mptamount.md) | `Amount` type excludes `MPTAmount`; `isAmount` guard unsound | minor | types | M |
| [018](018-ledger-entry-ledger-current-index-wrong-optionality.md) | `ledger_entry` result: `ledger_current_index` required but absent | minor | rpc | S |
| [019](019-integration-test-docs-stale.md) | Integration README/CONTRIBUTING/cfg/helper script disagree with CI | minor | test-infra | S |
| [020](020-feature-rpc-misreports-standalone-presets.md) | `feature` RPC misreports standalone presets; `isAmendmentEnabled` dead and wrong | minor | test-infra | M |
| [021](021-ci-xrpld-cfg-missing-newer-amendments.md) | CI cfg omits 11 supported amendments incl. `fixMPTDeliveredAmount` | minor | test-infra | S |
| [022](022-binary-codec-silently-truncates-mpt-values-above-2-64.md) | Codec silently truncates MPT values ≥ 2^64 | **blocker** | runtime | S |
| [023](023-binary-codec-accepts-non-canonical-mpt-value-strings.md) | Codec accepts `0x10`/`+7`/` 9`; raw `SyntaxError` on `1e2` | minor | validation | S |
| [024](024-holder-field-typing-inconsistent-account-alias.md) | `Holder` typed `string` vs `Account`; alias is bare `string` | paper-cut | types | S |
| [025](025-submitandwait-three-failure-surfaces-no-result-helper.md) | `submitAndWait` three failure surfaces; no result-code helper | major | runtime | M |
| [026](026-admin-commands-not-in-request-union.md) | Admin commands (`ledger_accept`) not in `Request` union | minor | rpc | S |
| [027](027-validators-write-to-console.md) | Validators `console.warn` on non-XLS-89 metadata | paper-cut | validation | S |
| [028](028-pre-emptive-ban-not-expressible-on-ledger.md) | Pre-emptive ban not expressible on-ledger; SDK silent on the model | major | protocol-mismatch | M |
| [029](029-protocol-behaviours-sdk-is-silent-about.md) | Ten lock/auth/clawback behaviours undocumented | minor | docs | S |
| [030](030-simulate-does-not-thread-transaction-type.md) | `simulate` does not thread `T`; skips flag/`DeliverMax` normalisation | minor | types | M |
| [031](031-ledger-entry-types-namespaced-undiscoverable.md) | Ledger types only under `LedgerEntry.*`; tests deep-import | paper-cut | docs | S |
| [032](032-feature-response-lacks-vetoed-and-vote-fields.md) | `feature` response lacks `vetoed` and vote fields | minor | rpc | S |
| [033](033-autofill-return-type-keeps-filled-fields-optional.md) | `autofill` return keeps filled fields optional | minor | types | S |
| [034](034-immutableflags-number-only-no-interface-form.md) | `ImmutableFlags` number-only despite exported interface | paper-cut | types | S |
| [035](035-rippled-error-data-untyped.md) | `RippledError.data` is `unknown`; not-found needs a structural guard | minor | types | M |
| [036](036-mptokenissuanceid-format-not-validated.md) | `MPTokenIssuanceID` format not validated | minor | validation | S |
| [037](037-mpt-validators-do-not-check-flag-masks.md) | MPT validators do not check flag masks | minor | validation | M |
| [038](038-isdomainid-rejects-zero-hash-that-clears-domain.md) | `isDomainID` rejects the zero hash that clears a domain | major | validation | S |
| [039](039-assetscale-range-not-validated.md) | `AssetScale` (and other UInt fields) range/integer not validated | minor | validation | S |
| [040](040-payment-self-send-not-caught.md) | Payment to self not caught (`temREDUNDANT`) | paper-cut | validation | S |
| [041](041-payment-validator-lacks-mpt-rules.md) | `validatePayment` lacks MPT rules (`SendMax`, `Paths`, zero) | minor | validation | M |
| [042](042-handledelivermax-compares-object-amounts-by-reference.md) | `handleDeliverMax` compares object amounts by reference | minor | runtime | S |
| [043](043-submitandwait-throws-doc-claims-tec-rejects.md) | `submitAndWait` `@throws` claims `tec*`/insufficient balance rejects | minor | docs | S |
| [044](044-simulate-doc-copy-pasted-from-submit.md) | `simulate` doc says it autofills/signs/submits | minor | docs | S |
| [045](045-assetscale-docs-contradictory.md) | `AssetScale` documented with inverted formulas; units unstated | minor | docs | S |
| [046](046-mptokenissuancecreate-doc-says-flags-immutable.md) | Create doc says flags are immutable; they are mutable unless pinned | minor | docs | S |
| [047](047-mptokenissuance-sequence-doc-wrong-for-ticketed-creates.md) | `Sequence` doc wrong for ticketed creates (ID uses `TicketSequence`) | minor | docs | S |
| [048](048-submitandwait-and-sign-examples-do-not-run.md) | `submitAndWait`/`sign` `@example` blocks do not compile or run | paper-cut | docs | S |
| [049](049-mptokenissuancecreate-transferfee-maximumamount-docs-wrong.md) | Create `TransferFee`/`MaximumAmount` docs contradict validator | paper-cut | docs | S |
| [050](050-mpt-transaction-models-missing-typedoc-category.md) | MPT transactions lack `@category Transaction Models` | paper-cut | docs | S |
| [051](051-read-side-doc-comments-inaccurate.md) | `LockedAmount`/`ReferenceHolding`/`AccountObject`/`ledger_entry` docs inaccurate | paper-cut | docs | S |
| [052](052-cantrade-docs-promise-dex-amm-the-sdk-cannot-express.md) | `CanTrade`/`AMMClawback` docs promise DEX/AMM; `temDISABLED` and no MPT-capable types | paper-cut | docs | S |
| [053](053-getbalancechanges-ignores-mpt-nodes.md) | `getBalanceChanges` ignores MPT nodes | major | runtime | M |
| [054](054-ledger-entry-credential-lookup-typed-with-wrong-key.md) | `ledger_entry` credential lookup typed `credentialType`; rippled needs `credential_type` | major | rpc | S |
| [055](055-ledger-entry-request-lacks-lookup-members-index-signature-hides-typos.md) | `ledger_entry` lacks domain/vault/oracle lookups; `BaseRequest` index signature hides typos | minor | rpc | M |
| [056](056-escrow-ledger-type-amount-string-issuernode-number.md) | `Escrow` ledger type: `Amount: string`, `IssuerNode: number` | minor | types | S |
| [057](057-payment-amount-required-but-v2-readback-has-delivermax.md) | `Payment.Amount` required but v2 read-back has `DeliverMax` only | minor | types | M |
| [058](058-transaction-stream-and-account-tx-meta-not-narrowed.md) | Stream / `account_tx` `meta` never narrows with `tx_json` | minor | types | M |
| [059](059-credential-flags-union-no-lsfaccepted-value.md) | `Credential.Flags` union; no `lsfAccepted` value or parser | minor | types | S |
| [060](060-ledger-data-labeled-entry-phantom-ledgerentrytype.md) | `LedgerDataLabeledLedgerEntry` requires phantom `ledgerEntryType` | paper-cut | rpc | S |
| [061](061-lowercase-field-names-silently-dropped-when-signing.md) | Lowercase field silently dropped when signing (`holder` → global freeze) | **blocker** | runtime | M |
| [062](062-submitandwait-expiry-check-precedes-final-tx-lookup.md) | `submitAndWait` expiry check precedes final `tx` lookup (false "expired") | major | runtime | S |
| [063](063-polling-errors-rewrapped-as-plain-error-undefined.md) | Polling errors rewrapped as plain `Error` starting with `undefined` | minor | runtime | S |
| [064](064-wallet-sign-rewrites-amount-before-validate.md) | `sign` rewrites `Amount` before `validate` (`TypeError`; Payment-only MPT grammar) | minor | runtime | S |
| [065](065-sign-accepts-interface-flags-then-fails-in-codec.md) | `sign` accepts interface `Flags`, fails in codec | minor | runtime | S |
| [066](066-account-validated-as-string-only.md) | `Account` validated as string only | minor | validation | S |
| [067](067-accountdelete-blocker-message-and-reserve-error-class.md) | AccountDelete blocker message wrong for MPT; reserve error plain `Error` | paper-cut | runtime | S |
| [068](068-holder-not-normalised-same-account-checks-textual.md) | `Holder` not X-address-normalised; same-account checks textual | minor | validation | S |
| [069](069-flag-error-text-dead-error-classes-stale-sign-throws.md) | Flag error text; dead error classes; stale `sign` `@throws` | paper-cut | runtime | S |
| [070](070-odd-length-hex-truncated-on-signed-path.md) | Odd-length hex: signed path drops a nibble, `simulate` pads one | major | validation | S |
| [071](071-credentialcreate-uri-capped-at-half-rippled-limit.md) | `CredentialCreate.URI` capped at 128 bytes; rippled allows 256 | major | validation | S |
| [072](072-escrow-validators-lack-preflight-rules.md) | Escrow validators lack preflight rules token escrows hit | minor | validation | S |
| [073](073-ismptissuer-unused-by-core-mpt-validators.md) | `isMPTIssuer` exists but core MPT validators never use it | minor | validation | S |
| [074](074-permissioned-domain-and-credential-fields-shape-only.md) | Permissioned-domain / credential fields shape-only | minor | validation | M |
| [075](075-ismptamount-rejects-objects-with-extra-undefined-keys.md) | `isMPTAmount` rejects objects with extra `undefined` keys | paper-cut | validation | S |
| [076](076-xls89-validator-ignores-uri-category-enum.md) | XLS-89 validator ignores `uris[].category` enum | paper-cut | validation | S |
| [077](077-getbalances-omits-mpt-holdings.md) | `getBalances` omits MPT holdings | major | runtime | M |
| [078](078-client-request-never-infers-api-version.md) | `request` never infers `api_version`; v1 typed as v2 | minor | types | M |
| [079](079-requestall-skips-partial-payment-warnings-and-address-normalisation.md) | `requestAll` skips partial-payment warnings and address normalisation | minor | rpc | S |
| [080](080-no-mpt-transferfee-helper-max-not-exported.md) | No MPT `TransferFee` helper; `MAX_TRANSFER_FEE` not exported | minor | missing-helper | S |

## Cross-cutting themes

1. **Types written from field lists, not from what rippled sends or accepts.** `MPToken` lacks
   `Account` and requires `MPTAmount` ([010](010-mptoken-ledger-type-mismatches-rippled-json.md));
   `MPTokenIssuance` lacks the injected `mpt_issuance_id` ([011](011-mptokenissuance-type-lacks-mpt-issuance-id.md));
   `ledger_entry` claims `ledger_current_index` ([018](018-ledger-entry-ledger-current-index-wrong-optionality.md));
   `feature` lacks `vetoed` ([032](032-feature-response-lacks-vetoed-and-vote-fields.md)); `Amount`
   still excludes MPT ([017](017-amount-type-excludes-mptamount.md)); `Escrow.Amount` is a string
   ([056](056-escrow-ledger-type-amount-string-issuernode-number.md)); `Payment.Amount` is required
   on read-back where only `DeliverMax` exists ([057](057-payment-amount-required-but-v2-readback-has-delivermax.md));
   the credential lookup key is misspelt ([054](054-ledger-entry-credential-lookup-typed-with-wrong-key.md));
   `ledger_data` requires a phantom field ([060](060-ledger-data-labeled-entry-phantom-ledgerentrytype.md)).
   A fixture-driven test ("decode this real JSON into this type") would have caught all of them.
2. **Responses are not discriminated by the request.** `ledger_entry` ([005](005-ledger-entry-response-never-narrows-node.md)),
   `account_objects` ([007](007-account-objects-type-filter-does-not-narrow.md)), `simulate`
   ([030](030-simulate-does-not-thread-transaction-type.md)), `submitAndWait` after `sign`
   ([002](002-wallet-sign-erases-transaction-type.md)), streams and `account_tx`
   ([058](058-transaction-stream-and-account-tx-meta-not-narrowed.md)), and `api_version`
   ([078](078-client-request-never-infers-api-version.md)) all return the widest shape although the
   request pins the answer. The pattern to copy exists in the same package (`binary: true`,
   `AccountInfoVersionResponseMap`).
3. **The escape hatch is in the base type — twice.** `Record<string, unknown>` on `BaseTransaction`
   ([004](004-basetransaction-record-string-unknown-collapses-keyof.md)) and `[x: string]: unknown`
   on `BaseRequest` ([055](055-ledger-entry-request-lacks-lookup-members-index-signature-hides-typos.md))
   mean no transaction or request literal is ever checked for typos. Combined with the codec's
   "skip lowercase keys" rule this becomes the [061](061-lowercase-field-names-silently-dropped-when-signing.md)
   blocker.
4. **Validation stops at "is a string", and where it goes further it is sometimes wrong.** Amount
   values, IDs, flag bits, `AssetScale`, hex parity, addresses on `Account` are pass-through
   ([016](016-mpt-amount-value-not-validated-no-scale-helper.md), [036](036-mptokenissuanceid-format-not-validated.md),
   [037](037-mpt-validators-do-not-check-flag-masks.md), [039](039-assetscale-range-not-validated.md),
   [070](070-odd-length-hex-truncated-on-signed-path.md), [066](066-account-validated-as-string-only.md),
   [072](072-escrow-validators-lack-preflight-rules.md), [074](074-permissioned-domain-and-credential-fields-shape-only.md)),
   so errors arrive from the codec, from `BigInt`, or from rippled. Helpers that would close the
   gaps already exist in the package but are unused (`isMPTIssuer`, `areAddressesEqual`,
   [073](073-ismptissuer-unused-by-core-mpt-validators.md), [068](068-holder-not-normalised-same-account-checks-textual.md)).
   The two strict checks that do exist reject legitimate input
   ([038](038-isdomainid-rejects-zero-hash-that-clears-domain.md), [071](071-credentialcreate-uri-capped-at-half-rippled-limit.md)).
5. **The sign path is ordered wrong.** `Wallet.sign` rewrites amounts before validating
   ([064](064-wallet-sign-rewrites-amount-before-validate.md)), validates a copy and encodes the
   original ([065](065-sign-accepts-interface-flags-then-fails-in-codec.md)), and lost its
   serialization round-trip in 2023 ([061](061-lowercase-field-names-silently-dropped-when-signing.md)).
6. **Failure has no single shape, and one of them is wrong.** `tem` throws with prose, `tec`
   resolves, `tef`/`ter` time out ([025](025-submitandwait-three-failure-surfaces-no-result-helper.md)),
   connection errors during polling become `Error("undefined …")` ([063](063-polling-errors-rewrapped-as-plain-error-undefined.md)),
   `RippledError.data` is `unknown` ([035](035-rippled-error-data-untyped.md)), `meta` may be a
   string that never occurs ([001](001-submitandwait-meta-string-undefined.md)) — and the expiry
   throw fires for validated transactions ([062](062-submitandwait-expiry-check-precedes-final-tx-lookup.md)).
7. **MPT got the fields but not the helpers.** No ID derivation, no keylets, no holder-flag
   parser, no unit or fee conversion, no `mpt_holders`, no MPT rows in `getBalances` /
   `getBalanceChanges` ([009](009-mptoken-flags-no-enum-or-parser.md), [012](012-no-helper-to-derive-mpt-issuance-id-or-keylets.md),
   [015](015-mpt-holders-request-untyped.md), [016](016-mpt-amount-value-not-validated-no-scale-helper.md),
   [053](053-getbalancechanges-ignores-mpt-nodes.md), [077](077-getbalances-omits-mpt-holdings.md),
   [080](080-no-mpt-transferfee-helper-max-not-exported.md)).
8. **Docs describe fields, not behaviour — and several are wrong.** Copy-pasted
   ([013](013-mptokenauthorize-docs-copy-pasted.md), [044](044-simulate-doc-copy-pasted-from-submit.md)),
   stale ([008](008-mptokenissuanceset-docs-incomplete.md), [019](019-integration-test-docs-stale.md),
   [046](046-mptokenissuancecreate-doc-says-flags-immutable.md)), self-contradictory
   ([045](045-assetscale-docs-contradictory.md), [049](049-mptokenissuancecreate-transferfee-maximumamount-docs-wrong.md)),
   dangerous ([043](043-submitandwait-throws-doc-claims-tec-rejects.md)), non-compiling
   ([048](048-submitandwait-and-sign-examples-do-not-run.md)), and silent on the ten behaviours a
   compliance issuer must know ([029](029-protocol-behaviours-sdk-is-silent-about.md), [028](028-pre-emptive-ban-not-expressible-on-ledger.md)).

## Prioritised recommendations

1. **Fix the three silent-wrong-transaction bugs first**: [022](022-binary-codec-silently-truncates-mpt-values-above-2-64.md)
   (codec range check), [061](061-lowercase-field-names-silently-dropped-when-signing.md) (reject
   unknown keys in `validate`, restore a round-trip in `sign`), [070](070-odd-length-hex-truncated-on-signed-path.md)
   (`isHex` parity). All three are a few lines and only reject input that was already wrong on the
   wire.
2. **Fix `submitAndWait`'s false expiry** ([062](062-submitandwait-expiry-check-precedes-final-tx-lookup.md),
   swap two statements) and stop rewrapping polling errors ([063](063-polling-errors-rewrapped-as-plain-error-undefined.md)).
   Then unify outcomes ([025](025-submitandwait-three-failure-surfaces-no-result-helper.md),
   [001](001-submitandwait-meta-string-undefined.md), [002](002-wallet-sign-erases-transaction-type.md),
   [035](035-rippled-error-data-untyped.md)) and fix the `@throws` doc ([043](043-submitandwait-throws-doc-claims-tec-rejects.md));
   merge the captain's `getTransactionResultCode`/`isTesSuccess` branch as the first step.
3. **Make the holder read path typeable**: add `MPToken` (and `DID`, `NFTokenPage`,
   `NFTokenOffer`) to `LedgerEntry` ([006](006-mptoken-missing-from-ledgerentry-union.md)), fix the
   `MPToken` fields ([010](010-mptoken-ledger-type-mismatches-rippled-json.md)), add
   `parseMPTokenFlags` ([009](009-mptoken-flags-no-enum-or-parser.md)), fix the credential lookup
   key ([054](054-ledger-entry-credential-lookup-typed-with-wrong-key.md)).
4. **Teach the balance helpers about MPT** ([053](053-getbalancechanges-ignores-mpt-nodes.md),
   [077](077-getbalances-omits-mpt-holdings.md)) and ship the MPT helpers
   ([012](012-no-helper-to-derive-mpt-issuance-id-or-keylets.md), [015](015-mpt-holders-request-untyped.md),
   [016](016-mpt-amount-value-not-validated-no-scale-helper.md), [080](080-no-mpt-transferfee-helper-max-not-exported.md)).
5. **Discriminate responses by request** ([005](005-ledger-entry-response-never-narrows-node.md),
   [007](007-account-objects-type-filter-does-not-narrow.md), [058](058-transaction-stream-and-account-tx-meta-not-narrowed.md),
   [078](078-client-request-never-infers-api-version.md), [030](030-simulate-does-not-thread-transaction-type.md));
   type-only, same pattern as `binary`.
6. **Close the validator gaps in one PR** with `probes.ts` as the oracle: flag masks
   ([037](037-mpt-validators-do-not-check-flag-masks.md)), issuance-ID format
   ([036](036-mptokenissuanceid-format-not-validated.md)), UInt ranges ([039](039-assetscale-range-not-validated.md)),
   MPT payment rules ([041](041-payment-validator-lacks-mpt-rules.md)), `MPTokenAuthorize`
   ([014](014-validatemptokenauthorize-enforces-nothing.md)), issuer checks ([073](073-ismptissuer-unused-by-core-mpt-validators.md)),
   address checks ([066](066-account-validated-as-string-only.md), [068](068-holder-not-normalised-same-account-checks-textual.md)),
   escrow and credential rules ([072](072-escrow-validators-lack-preflight-rules.md), [074](074-permissioned-domain-and-credential-fields-shape-only.md));
   and un-reject the zero `DomainID` and long URIs ([038](038-isdomainid-rejects-zero-hash-that-clears-domain.md),
   [071](071-credentialcreate-uri-capped-at-half-rippled-limit.md)). Reorder `Wallet.sign`
   ([064](064-wallet-sign-rewrites-amount-before-validate.md), [065](065-sign-accepts-interface-flags-then-fails-in-codec.md)).
7. **Decide on the two index signatures** ([004](004-basetransaction-record-string-unknown-collapses-keyof.md),
   [055](055-ledger-entry-request-lacks-lookup-members-index-signature-hides-typos.md)). The only
   breaking change on this list and the one with the widest blast radius; schedule it for a major
   release with `LenientTransaction`/`LenientRequest` aliases.
8. **Docs pass** over the MPT transaction files, `Clawback`, `simulate`, `submitAndWait` and the
   ledger types using the tables in [029](029-protocol-behaviours-sdk-is-silent-about.md) and
   [028](028-pre-emptive-ban-not-expressible-on-ledger.md); fix the integration README and cfg
   ([019](019-integration-test-docs-stale.md), [020](020-feature-rpc-misreports-standalone-presets.md),
   [021](021-ci-xrpld-cfg-missing-newer-amendments.md)); compile `@example` blocks in CI
   ([048](048-submitandwait-and-sign-examples-do-not-run.md)).

## Method and round log

**Round 1** — build `mpt-issuer/` end-to-end and file every edge hit. Findings 001–042.
Evidence runs (all on rippled 3.4.0-rc1, `rippleci/xrpld:develop` digest `sha256:898feb09…`):
`check-amendments`, `issue`, `holders`, `freeze`, `ban`, `clawback`, `domain`, `probes`,
`scenario` (63/63), plus two one-off probes recorded in the findings (codec encode/decode table in
[022](022-binary-codec-silently-truncates-mpt-values-above-2-64.md)/[023](023-binary-codec-accepts-non-canonical-mpt-value-strings.md);
`autofill` `DeliverMax` table in [042](042-handledelivermax-compares-object-amounts-by-reference.md)).
Captain's seeds: all five verified and filed (001–005). Firstmate candidates: all verified.

**Round 2** — five read-only adversarial sweeps run in parallel (one lens each) over every
MPT-touching file, each candidate re-verified by the auditor before filing. Sweep logs:

- **Sweep a (types vs rippled reality)**: `models/ledger/*`, `models/transactions/{MPT*,clawback,payment,metadata,common}`, `models/methods/{ledgerEntry,accountObjects,ledgerData,accountTx,tx,simulate,subscribe}`, codec `definitions.json`. 9 candidates → 8 filed (053, 054, 055, 056, 057, 058, 059, 060; the ninth folded into 052 and 011). Verified live: `getBalanceChanges` on MPT payment/clawback metadata; `ledger_entry` `credential` with both key spellings (`credentialType` → `malformedRequest: Missing field 'credential_type'`); MPT escrow entry (`Amount` object); `Credential.Flags` = 65536 after accept; v2 `tx_json` has `DeliverMax`, no `Amount`.
- **Sweep b (validators vs rippled preflight)**: every MPT/credential/domain/escrow validator and `common.ts` guard. 9 candidates → 7 filed (070, 071, 072, 073, 074, 075, 076), 2 folded into 039 and 068. Verified live: `CredentialType: 'ABC'` stored as `0ABC` via `simulate` vs `AB` via signed blob; 200-byte URI rejected by SDK, `tesSUCCESS` when signed manually, 300 bytes `temMALFORMED`; escrow `CancelAfter == FinishAfter` → `temBAD_EXPIRATION`, MPT value 0 → `temBAD_AMOUNT`, `Condition` without `Fulfillment` → `temMALFORMED`; `PermissionedDomainSet` zero `DomainID` and case-variant duplicate credentials → `temMALFORMED`. Dropped: "MPT escrows require `CancelAfter`" (live: `FinishAfter`-only MPT escrow is `tesSUCCESS`).
- **Sweep c (request/response narrowing and helper gaps)**: `client/index.ts`, `client/partialPayment.ts`, `sugar/*`, `utils/*`, `models/methods/index.ts`. 9 candidates → 4 filed (077, 078, 079, 080), 5 duplicates of sweep-a findings or folded (053, 058, 068, 055, 052). Verified live: `getBalances(holder)` = XRP only with one `MPToken` on the ledger. Verified offline: `api_version: 1` typed as v2; request-literal typos compile; `MAX_TRANSFER_FEE` not exported; `percentToTransferRate('1%')` = 1010000000.
- **Sweep d (doc accuracy)**: every doc comment in the MPT-touching files, `client/index.ts` docs, `Wallet.sign`, README/HISTORY/CONTRIBUTING/cfg. 15 candidates → 10 filed (043–052), 3 folded into 008, 012, 019; 2 dropped as accurate on re-read. Verified live: ticketed create derives the ID from `TicketSequence` (656) not `Sequence` (0); `OfferCreate` with an MPT amount → `temDISABLED`.
- **Sweep e (error surfaces)**: `submitAndWait` → `autofill` → `sign` → `submit` → polling; `RequestManager`; `errors.ts`. 12 candidates → 9 filed (061–069), 1 folded into 068, 2 dropped (not on the MPT surface). Verified offline against the built package: lowercase `holder` dropped (decoded `Holder === undefined`), `assetScale` dropped; `TypeError`s from `removeTrailingZeros`; Payment-only `"10.0"` → `10`; interface `Flags` → codec `UInt32` error; `Account: 'not-an-address'` → address-codec error; tagged X-address `Holder` → codec error; flag error text. Verified live: `LastLedgerSequence = validated + 2` payment validated `tesSUCCESS` but `submitAndWait` threw "expired … Preliminary result: tesSUCCESS". Historical claims checked against local git: `07f36e12` (#1883) reordered the expiry check; `2442ef14` (#2293) removed `checkTxSerialization`.

Round 2 total: 38 new findings (1 blocker, 6 major, 21 minor, 10 paper-cuts). Round 3 sweeps are
logged below as they complete.
