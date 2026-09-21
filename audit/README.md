# xrpl.js MPT API audit

Audit of the `xrpl` package (this checkout, 5.2.0 at `f79b82c9`) as seen by a TypeScript developer
issuing and operating a **compliance-grade Multi-Purpose Token**: clawback, pre-emptive address
bans, freeze-on-ban, and a global freeze. The instrument is a runnable project,
[`mpt-issuer/`](mpt-issuer/), that does all of that against a local standalone rippled using this
checkout's build of `xrpl`; every rough edge hit on the way is a numbered finding in this directory.

## Executive summary

- **42 findings**: 1 blocker, 11 major, 25 minor, 5 paper-cuts. Full table below.
- **The blocker is in the binary codec** ([022](022-binary-codec-silently-truncates-mpt-values-above-2-64.md)):
  an MPT `value` of 2^64 + 5 is signed and submitted as **5**, with no error from any layer. Fix is
  a one-line range check.
- **The four captain's requirements are achievable, with one honest caveat**: "pre-emptively ban an
  address" has no on-ledger representation. The closest model (allow-listing + never authorize +
  lock-on-arrival + lock-and-clawback for current holders) is implemented in `mpt-issuer/src/ban.ts`
  and proven in the scenario; the limits are in [028](028-pre-emptive-ban-not-expressible-on-ledger.md).
- **The scenario is green**: `npm run scenario` → 63/63 assertions pass on rippled 3.4.0-rc1
  (`rippleci/xrpld:develop`).
- **The type-level seeds from the captain's notes all reproduce** ([001](001-submitandwait-meta-string-undefined.md),
  [002](002-wallet-sign-erases-transaction-type.md), [003](003-transaction-literals-widen-no-factory.md),
  [004](004-basetransaction-record-string-unknown-collapses-keyof.md),
  [005](005-ledger-entry-response-never-narrows-node.md)), and they compound: because
  [006](006-mptoken-missing-from-ledgerentry-union.md) leaves `MPToken` out of the `LedgerEntry`
  union, the holder-side read path (balance, lock, authorization) is unreachable without
  `as unknown as`, which the repo's own tests acknowledge with `@ts-expect-error`.
- **Client-side validation is thin exactly where MPTs are new**: `validate()` accepts every
  malformed MPT amount, every unknown flag bit, any string as an issuance ID, and rejects the one
  value rippled uses to clear a domain ([016](016-mpt-amount-value-not-validated-no-scale-helper.md),
  [037](037-mpt-validators-do-not-check-flag-masks.md), [036](036-mptokenissuanceid-format-not-validated.md),
  [038](038-isdomainid-rejects-zero-hash-that-clears-domain.md)).
- **Every forced cast, `!`, or `@ts-expect-error` in `mpt-issuer/` is tagged `AUDIT-NNN`** in a
  comment; `grep -rn AUDIT- mpt-issuer/src` lists them.

## Design mapping: requirement → ledger mechanism → xrpl.js calls

| Requirement | Ledger mechanism | xrpl.js | Achievable as stated? |
| --- | --- | --- | --- |
| 1. Clawback | `MPTokenIssuanceCreate` with `tfMPTCanClawback`; `Clawback { Amount: { mpt_issuance_id, value }, Holder }` | `mpt-issuer/src/ban.ts` `clawbackTx`, `clawback.ts` | **Yes.** Works while the holder is locked, unauthorized, and during a global freeze; claws back `min(value, balance)`; empty holder → `tecINSUFFICIENT_FUNDS`; no MPToken → `tecOBJECT_NOT_FOUND`. |
| 2. Pre-emptive ban | `tfMPTRequireAuth` (allow-list). A never-authorized address cannot receive (`tecNO_AUTH`). **Nothing can be written on-ledger for an address that has not opted in** (`MPTokenAuthorize`/`MPTokenIssuanceSet` with `Holder` → `tecOBJECT_NOT_FOUND`), and opt-in cannot be prevented. | `ban.ts` `banAddress` (local registry) + `authorizeUnlessBanned` (guard) + `sweepBanned` (lock-on-arrival) | **Not as stated.** Closest: off-ledger registry + refuse to authorize + lock the empty MPToken the moment it appears. rippled cannot enumerate holders (`mpt_holders` is Clio-only), so the sweep polls `ledger_entry` per banned address. Alternative: permissioned-domain admission (`DomainID` + credentials), where "ban" = never issue / revoke the credential; still not pre-emptive, cannot be combined with `Holder`. See [028](028-pre-emptive-ban-not-expressible-on-ledger.md). |
| 3. Freeze newly banned accounts | `MPTokenIssuanceSet { Holder, Flags: tfMPTLock }` sets `lsfMPTLocked` on the holder's `MPToken`. Requires `tfMPTCanLock` on the issuance. | `freeze.ts` `holderLock`, used by `ban.ts` | **Yes**, once the MPToken exists. Lock works on a zero-balance unauthorized entry, survives a later (mistaken) authorization (`tecLOCKED` beats auth), blocks holder↔holder both ways. Caveats: issuer↔holder payments are still allowed under a per-holder lock; a locked holder can never delete its entry. Clawback is unaffected, so "ban" = lock + clawback in one call. |
| 4. Global freeze | `MPTokenIssuanceSet { Flags: tfMPTLock }` (no `Holder`) sets `lsfMPTLocked` on the `MPTokenIssuance`; `tfMPTUnlock` clears it. | `freeze.ts` `globalLock`/`globalUnlock`; verified via `parseMPTokenIssuanceFlags` | **Yes**, with the same exemption: holder↔holder payments fail with `tecLOCKED`, but the issuer can still pay holders and holders can still redeem to the issuer. Idempotent. Per-holder locks are independent bits and survive a global unlock. |

Immutability: the issuer pins `ImmutableFlags = tifMPTCanTrade | tifMPTCanEscrow |
tifMPTCanHoldConfidentialBalance` (capabilities that must never be switched on later; `tfMPTSet*`
are one-way *on*, so this is the only way to promise holders the token will not become
tradable/escrowable/confidential) plus the three safety flags for documentation value. Verified:
`tfMPTSetCanTrade` on the pinned issuance → `tecNO_PERMISSION`.

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
  `MPTokensV1`, `DynamicMPT`, `Clawback`, `PermissionedDomains`, `Credentials` are in effect.
- Ledgers do not close by themselves; the project runs `ledger_accept` every 400 ms
  (`mpt-issuer/src/session.ts`) so that the real `submitAndWait` path is exercised.
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
build is what runs; `node_modules/xrpl` is a symlink to `../../packages/xrpl`.

`npm run probes` prints, for ~50 deliberately malformed MPT transactions, what the SDK's
`validate()` says next to what rippled's `simulate` says; rows marked `<-- SDK could catch` are the
validator gaps ([014](014-validatemptokenauthorize-enforces-nothing.md), [036](036-mptokenissuanceid-format-not-validated.md)–[041](041-payment-validator-lacks-mpt-rules.md)).

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
| [029](029-protocol-behaviours-sdk-is-silent-about.md) | Eight lock/auth/clawback behaviours undocumented | minor | docs | S |
| [030](030-simulate-does-not-thread-transaction-type.md) | `simulate` does not thread `T`; skips flag/`DeliverMax` normalisation | minor | types | M |
| [031](031-ledger-entry-types-namespaced-undiscoverable.md) | Ledger types only under `LedgerEntry.*`; tests deep-import | paper-cut | docs | S |
| [032](032-feature-response-lacks-vetoed-and-vote-fields.md) | `feature` response lacks `vetoed` and vote fields | minor | rpc | S |
| [033](033-autofill-return-type-keeps-filled-fields-optional.md) | `autofill` return keeps filled fields optional | minor | types | S |
| [034](034-immutableflags-number-only-no-interface-form.md) | `ImmutableFlags` number-only despite exported interface | paper-cut | types | S |
| [035](035-rippled-error-data-untyped.md) | `RippledError.data` is `unknown`; not-found needs a structural guard | minor | types | M |
| [036](036-mptokenissuanceid-format-not-validated.md) | `MPTokenIssuanceID` format not validated | minor | validation | S |
| [037](037-mpt-validators-do-not-check-flag-masks.md) | MPT validators do not check flag masks | minor | validation | M |
| [038](038-isdomainid-rejects-zero-hash-that-clears-domain.md) | `isDomainID` rejects the zero hash that clears a domain | major | validation | S |
| [039](039-assetscale-range-not-validated.md) | `AssetScale` range not validated | minor | validation | S |
| [040](040-payment-self-send-not-caught.md) | Payment to self not caught (`temREDUNDANT`) | paper-cut | validation | S |
| [041](041-payment-validator-lacks-mpt-rules.md) | `validatePayment` lacks MPT rules (`SendMax`, `Paths`, zero) | minor | validation | M |
| [042](042-handledelivermax-compares-object-amounts-by-reference.md) | `handleDeliverMax` compares object amounts by reference | minor | runtime | S |

## Cross-cutting themes

1. **Types written from field lists, not from what rippled sends or accepts.** `MPToken` lacks
   `Account` and requires `MPTAmount` ([010](010-mptoken-ledger-type-mismatches-rippled-json.md));
   `MPTokenIssuance` lacks the injected `mpt_issuance_id` ([011](011-mptokenissuance-type-lacks-mpt-issuance-id.md));
   `ledger_entry` claims `ledger_current_index` ([018](018-ledger-entry-ledger-current-index-wrong-optionality.md));
   `feature` lacks `vetoed` ([032](032-feature-response-lacks-vetoed-and-vote-fields.md)); `Amount`
   still excludes MPT ([017](017-amount-type-excludes-mptamount.md)). A fixture-driven test
   ("decode this real JSON into this type") would have caught all of them.
2. **Responses are not discriminated by the request.** `ledger_entry` ([005](005-ledger-entry-response-never-narrows-node.md)),
   `account_objects` ([007](007-account-objects-type-filter-does-not-narrow.md)), `simulate`
   ([030](030-simulate-does-not-thread-transaction-type.md)), and `submitAndWait` after `sign`
   ([002](002-wallet-sign-erases-transaction-type.md)) all return the widest union although the
   request pins the answer. The pattern to copy exists in the same package (`binary: true`,
   `AccountInfoVersionResponseMap`).
3. **The escape hatch is in the base type.** `Record<string, unknown>` on `BaseTransaction`
   ([004](004-basetransaction-record-string-unknown-collapses-keyof.md)) means no transaction literal
   is ever checked for typos and no utility type works. This is the single most surprising
   behaviour for anyone building tooling on the models.
4. **Validation stops at "is a string".** Amount values, IDs, flag bits, `AssetScale` are
   pass-through ([016](016-mpt-amount-value-not-validated-no-scale-helper.md), [036](036-mptokenissuanceid-format-not-validated.md),
   [037](037-mpt-validators-do-not-check-flag-masks.md), [039](039-assetscale-range-not-validated.md)),
   so errors arrive from the codec (`Error`), from `BigInt` (`SyntaxError`), or from rippled
   (`tem*` in prose) — never as a `ValidationError` naming the field. Meanwhile the one strict
   check that exists (`isDomainID`) rejects a legitimate value ([038](038-isdomainid-rejects-zero-hash-that-clears-domain.md)).
5. **Failure has no single shape.** `tem` throws with prose, `tec` resolves, `tef`/`ter` time out
   ([025](025-submitandwait-three-failure-surfaces-no-result-helper.md)); `RippledError.data` is
   `unknown` ([035](035-rippled-error-data-untyped.md)); `meta` may be a string that never occurs
   ([001](001-submitandwait-meta-string-undefined.md)).
6. **MPT got the fields but not the helpers.** No ID derivation, no keylets, no holder-flag parser,
   no unit conversion, no `mpt_holders`, no "is this holder locked" — every issuer re-implements
   them ([009](009-mptoken-flags-no-enum-or-parser.md), [012](012-no-helper-to-derive-mpt-issuance-id-or-keylets.md),
   [015](015-mpt-holders-request-untyped.md), [016](016-mpt-amount-value-not-validated-no-scale-helper.md)).
7. **Docs describe fields, not behaviour.** Copy-pasted ([013](013-mptokenauthorize-docs-copy-pasted.md)),
   stale ([008](008-mptokenissuanceset-docs-incomplete.md), [019](019-integration-test-docs-stale.md)),
   and silent on the eight behaviours a compliance issuer must know
   ([029](029-protocol-behaviours-sdk-is-silent-about.md), [028](028-pre-emptive-ban-not-expressible-on-ledger.md)).

## Prioritised recommendations

1. **Fix [022](022-binary-codec-silently-truncates-mpt-values-above-2-64.md) now** (one regex +
   one comparison in `ripple-binary-codec`), and land [016](016-mpt-amount-value-not-validated-no-scale-helper.md)'s
   `isMPTValue` in `xrpl` so the two layers agree. Silent wrong amounts on the wire are the only
   money-losing item here.
2. **Make the holder read path typeable**: add `MPToken` (and `DID`, `NFTokenPage`,
   `NFTokenOffer`) to `LedgerEntry` ([006](006-mptoken-missing-from-ledgerentry-union.md)), fix the
   `MPToken` fields ([010](010-mptoken-ledger-type-mismatches-rippled-json.md)), add
   `parseMPTokenFlags` ([009](009-mptoken-flags-no-enum-or-parser.md)). Three small, non-breaking
   changes that remove every `as unknown as` in an issuer's code.
3. **Discriminate `ledger_entry` and `account_objects` by request** ([005](005-ledger-entry-response-never-narrows-node.md),
   [007](007-account-objects-type-filter-does-not-narrow.md)); type-only, same pattern as `binary`.
4. **Ship the MPT helpers** ([012](012-no-helper-to-derive-mpt-issuance-id-or-keylets.md)):
   `getMPTokenIssuanceID`, `hashMPTokenIssuance`, `hashMPToken`, `mptToUnits`/`unitsToMpt`; and
   `MPTHoldersRequest` ([015](015-mpt-holders-request-untyped.md)).
5. **Unify transaction outcomes** ([025](025-submitandwait-three-failure-surfaces-no-result-helper.md),
   [001](001-submitandwait-meta-string-undefined.md), [002](002-wallet-sign-erases-transaction-type.md),
   [035](035-rippled-error-data-untyped.md)): typed `TransactionFailedError`, `Binary`/`Validated`
   parameters on `TxResponse`, phantom-typed `SignedBlob<T>`, typed `RippledError.data`; merge the
   captain's `getTransactionResultCode`/`isTesSuccess` branch as the first step.
6. **Close the validator gaps** in one PR with `probes.ts` as the test oracle: flag masks
   ([037](037-mpt-validators-do-not-check-flag-masks.md)), issuance-ID format
   ([036](036-mptokenissuanceid-format-not-validated.md)), `AssetScale`
   ([039](039-assetscale-range-not-validated.md)), MPT payment rules
   ([041](041-payment-validator-lacks-mpt-rules.md)), `MPTokenAuthorize`
   ([014](014-validatemptokenauthorize-enforces-nothing.md)), and un-reject the zero `DomainID`
   ([038](038-isdomainid-rejects-zero-hash-that-clears-domain.md)).
7. **Decide on `BaseTransaction`'s index signature** ([004](004-basetransaction-record-string-unknown-collapses-keyof.md)).
   It is the one breaking change on this list and the one with the widest blast radius; schedule it
   for a major release with a `LenientTransaction` alias.
8. **Docs pass** over the four MPT transaction files and `Clawback` using
   [029](029-protocol-behaviours-sdk-is-silent-about.md)'s table and
   [028](028-pre-emptive-ban-not-expressible-on-ledger.md)'s compliance model; fix the integration
   README and cfg comments ([019](019-integration-test-docs-stale.md), [020](020-feature-rpc-misreports-standalone-presets.md),
   [021](021-ci-xrpld-cfg-missing-newer-amendments.md)).

## Method and round log

**Round 1** — build `mpt-issuer/` end-to-end and file every edge hit. Findings 001–042.
Evidence runs (all on rippled 3.4.0-rc1, `rippleci/xrpld:develop` digest `sha256:898feb09…`):
`check-amendments`, `issue`, `holders`, `freeze`, `ban`, `clawback`, `domain`, `probes`,
`scenario` (63/63), plus two one-off probes recorded in the findings (codec encode/decode table in
[022](022-binary-codec-silently-truncates-mpt-values-above-2-64.md)/[023](023-binary-codec-accepts-non-canonical-mpt-value-strings.md);
`autofill` `DeliverMax` table in [042](042-handledelivermax-compares-object-amounts-by-reference.md)).
Captain's seeds: all five verified and filed (001–005). Firstmate candidates: all verified
(013/014 Authorize docs+validator; 009 MPToken flags; 008/037/038 IssuanceSet; 016/024/029
Clawback; 012 `mptID!`; 016/023/027 amounts+metadata; 005/006/007/015 lookups; the tests'
`as`/`!`/`@ts-expect-error` sites map to 001, 006, 007, 011, 012, 042).

Round 2+ sweep logs are appended below as they complete.
