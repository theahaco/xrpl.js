# Public surface review — published xrpl 5.3.0

This review uses the installed npm package, its shipped source, TypeScript 5.9.3 in strict mode, and local runtime probes. It does not infer the original authors' intentions. Findings may overlap the earlier audit and existing aha proposals; their IDs below are evidence IDs, not additional issue counts. No upstream issues or pull requests were created.

The complete named root inventory is [api-inventory.json](api-inventory.json), summarized in [api-coverage.md](api-coverage.md). It contains **447 named root exports**, including **137 runtime values**, plus **54 qualified LedgerEntry members** and **15 hashes members**. Supporting packages are represented through their re-exports only.

## Strongest evidence

### SURF-01 — Published declarations remove the inline documentation developers need

**Priority:** high. **Depth:** declaration/source comparison plus actual TypeScript language-service hover probes.

None of the 447 root export symbols has compiler-visible JSDoc prose in the installed declaration graph. The shipped TypeScript source has prose for 344 of those symbols. This is a packaging/distribution problem as well as a documentation problem: useful existing guidance does not arrive in ordinary package hovers.

The language service returns signatures with empty documentation for `new Client`, `Client.request`, `Wallet.generate`, and `xrpToDrops`. `Client.on` shows generic inherited EventEmitter documentation, so this is not a claim that every possible hover is empty. Declaration maps and the included source did not restore those four hovers in this reproduction.

**Proof:** `surface-probes.json`, `quickInfo`; inventory totals. Published [dist/npm/client/index.d.ts:12](https://unpkg.com/xrpl@5.3.0/dist/npm/client/index.d.ts), [dist/npm/Wallet/index.d.ts:3](https://unpkg.com/xrpl@5.3.0/dist/npm/Wallet/index.d.ts), and their commented `src` counterparts. The local repository build config sets `removeComments: true` in [packages/xrpl/tsconfig.json:13](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/tsconfig.json#L13); the observed npm declarations establish the release behavior independently of that checkout.

**Recommendation:** preserve declaration JSDoc, then verify package-consumer hovers and completion descriptions against the packed artifact. Audit the restored prose for correctness before treating its presence as quality. This is the first improvement to demonstrate in an editor walkthrough.

### SURF-02 — Event payload safety changes with how the listener is registered

**Priority:** high. **Depth:** strict compiler checks and local event dispatch.

An inferred `on('ledgerClosed', ledger => ...)` receives `LedgerStream` correctly. But `on('ledgerClosed', (ledger: string) => ledger.toUpperCase())` is also accepted. The unconstrained listener generic accepts the explicit incompatible callback. Emitting a ledger object then throws `TypeError: ledger.toUpperCase is not a function`.

The inherited `once('ledgerClosed', ledger => ledger.nonexistent())` also compiles; its payload is inferred as `any`. A developer changing a subscription from repeated to one-shot loses the type guidance without a warning.

**Proof:** `surface-probes.json`, probes `event-on-inference`, `event-on-wrong-listener`, `event-once-inference`; `surface-runtime-probes.json`, `event-on-wrong-listener`. Published [src/client/index.ts:439](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/client/index.ts#L439), [src/models/methods/subscribe.ts:494](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/models/methods/subscribe.ts#L494), inherited `eventemitter3/index.d.ts` methods.

**Recommendation:** use one event-to-argument map for all event registration methods. Require compatible callbacks for `on`, `once`, and aliases; retain correct contextual inference. Treat the correctly inferred `on` behavior as a positive control to preserve.

### SURF-03 — Pagination helpers offer inconsistent support and misleading defaults

**Priority:** medium. **Depth:** compiler checks, local preflight execution and a two-page mock.

`client.request({command:'account_nfts', account})` is supported, but the same request is rejected by `requestNextPage`. Its closed request union includes only six commands. `requestAll` accepts `account_nfts` without a `collect` argument, then immediately throws `ValidationError: no collect key for command account_nfts`. The source documentation describes the general helper as not recommended for ordinary use, but that caveat is stripped from published declarations.

The `requestAll` source prose also says omitting `limit` causes one request; implementation uses `Infinity`. A local fake connection returning two pages confirms that the no-limit call makes two requests. This is a documentation mismatch, not evidence of live-server pagination failure.

**Proof:** `surface-probes.json`, `nft-pagination-next` and `nft-pagination-all`; runtime probes `nft-pagination-all` and `pagination-default-multiple-pages`. Published [src/client/index.ts:124](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/client/index.ts#L124), `:450`, `:478`, `:494`; [src/models/methods/index.ts:496](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/models/methods/index.ts#L496).

**Recommendation:** provide a typed paging surface for supported paginated commands, ideally an async iterator with explicit page/item semantics. For an incremental fix, expand the command/collection mapping, require `collect` when it cannot be inferred, and correct the default-limit documentation.

### SURF-04 — Locally knowable request and submission mistakes survive type checking

**Priority:** medium. **Depth:** compiler checks, source validation rule, and offline submission preflight.

Both `{command:'tx'}` and `{command:'tx', transaction:'hash', ctid:'ctid'}` satisfy `TxRequest`, despite its source documentation requiring exactly one identifier. The two fields are independently optional. Separately, a plainly unsigned JSON Payment compiles when passed to `submit` without a wallet, then fails immediately with `Wallet must be provided when submitting an unsigned transaction`.

**Proof:** `surface-probes.json`, `tx-missing-identifier`, `tx-conflicting-identifiers`, `unsigned-submit-no-wallet`; runtime probe of the latter. Published [src/models/methods/tx.ts:18](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/models/methods/tx.ts#L18), [src/client/index.ts:790](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/client/index.ts#L790), [src/sugar/submit.ts:225](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/sugar/submit.ts#L225).

**Recommendation:** encode exclusive selectors in request unions; distinguish signed submissions from unsigned drafts that require a wallet. Preserve intentionally flexible escape hatches explicitly instead of allowing invalid ordinary calls. The tx selector rule was verified against the shipped source contract, not a live server rejection.

### SURF-05 — Decoding and error recovery do not provide a guided typed path

**Priority:** medium. **Depth:** declaration/source review and compiler checks. **Classification:** design opportunity, not a claim that unknown external data should be trusted.

`decode(encode(payment))` returns `Record<string, unknown>`, which cannot be passed to `Wallet.sign` without further work. Returning unknown data from a general ledger/transaction decoder is defensible; the missing element is an obvious validated transaction-decoding path with a useful resulting type.

After `error instanceof RippledError`, `error.data` is still `unknown`, so a developer cannot inspect `error.data.error` directly. The request manager creates this subclass from RPC error responses, but the public subclass adds no typed payload or error-code accessor. Application code must invent its own runtime guard or assertion.

**Proof:** `surface-probes.json`, `decode-sign-roundtrip` and `error-discovery`. Published [src/utils/index.ts:147](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/utils/index.ts#L147), [src/errors.ts:11](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/errors.ts#L11), `:62`, [src/client/RequestManager.ts:198](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/client/RequestManager.ts#L198).

**Recommendation:** add validated decoders or type guards and typed accessors for known RPC error fields. Maintain `unknown` for truly unclassified data; do not promise a caller-selected generic type without validation.

### SURF-06 — A general balance helper silently omits public MPT balance changes

**Priority:** high for applications relying on the helper's broad promise; otherwise medium. **Depth:** source inspection and synthetic metadata execution. **Limit:** not a recorded live-ledger transaction; no confidential-balance claim.

`getBalanceChanges` is documented in source as computing the complete list of every changed balance. Its implementation handles only `AccountRoot` and `RippleState`. A synthetic `ModifiedNode` with `LedgerEntryType:'MPToken'` and `MPTAmount` changing from `'10'` to `'25'` produces an empty result. The output `Balance` model also has no MPT issuance identifier.

**Proof:** runtime probe `mpt-balance-change-coverage`. Published [src/utils/getBalanceChanges.ts:154](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/utils/getBalanceChanges.ts#L154), `:168`, `:175`; [src/models/common/index.ts:37](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/models/common/index.ts#L37); [src/models/ledger/MPToken.ts:3](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/models/ledger/MPToken.ts#L3).

**Recommendation:** explicitly document the existing XRP/trustline scope immediately, then add a type-safe public-MPT balance representation and handling. Validate the extension against captured ledger fixtures. Confidential balances need a separately specified treatment and should not be implied by this proposal.

### SURF-07 — Number-returning XRP conversion can lose a drop

**Priority:** medium; impacts very large values in the verified example. **Depth:** direct runtime execution.

`dropsToXrp('9007199254740991')` returns `9007199254.740992`; converting it back produces `'9007199254740992'`, one drop more than the input. The implementation uses arbitrary-precision arithmetic and then returns a JavaScript number. `getXrpBalance` also returns a number, and `getBalanceChanges` routes XRP amounts through this conversion before returning a string.

**Proof:** runtime probe `amount-precision-roundtrip`. Published [src/utils/xrpConversion.ts:53](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/utils/xrpConversion.ts#L53), [src/utils/getBalanceChanges.ts:107](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/utils/getBalanceChanges.ts#L107); public `Client.getXrpBalance` return declaration.

**Recommendation:** provide an exact string/decimal conversion and balance path, with a deliberate migration strategy for existing number-returning APIs. This is a reproducible representation limitation, not evidence of any real transaction losing funds.

### SURF-08 — Restoring comments alone will expose stale source examples

**Priority:** medium. **Depth:** static source review.

The Wallet class example calls `seedWallet.signTransaction`, although the public method is `sign`. The `submitAndWait` example omits awaiting/destructuring both `fundWallet()` calls, refers to undefined `signedTransaction` and `result`, and calls `submit` instead of demonstrating `submitAndWait`. The `requestAll` example uses `transaction_data`, which is not in the public Request union.

**Proof:** published [src/Wallet/index.ts:60](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/Wallet/index.ts#L60); [src/client/index.ts:819](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/client/index.ts#L819), `:830`, `:474`. These are source-example findings; source comments are absent in package hovers today.

**Recommendation:** compile example snippets as package consumers and align them with the portal's maintained examples. Make examples exercise the public workflow rather than merely look plausible in rendered documentation.

## Positive controls and constraints

The `Transaction` discriminant already guides a Payment to its required `Amount` and `Destination`; the probe for a missing Payment payload fails as expected. Confidential batch operation recipes also use a useful discriminated union: choosing `operation:'send'` makes TypeScript require `destination` and `senderKeypair`. Confidential amounts use bigint. These are patterns to preserve and extend.

Explicitly annotated `Payment` values and ordinary inferred `on` callbacks are not uniformly broken. A successful proposal should preserve these strengths and repair the gaps between steps. Network-dependent validity, authorization, account state and amendment availability still require runtime checking.

## Review depth across the complete inventory

Every family below has compiler inventory coverage. “Static sample” means representative declarations/source were inspected; it does not assert every exported member's behavior was exercised.

| Family | Additional work in this surface review | Remaining uncertainty |
|---|---|---|
| Client and connection | Public members; request, events, submission and pagination source; compile and offline/mock execution | Real connection lifecycle, network timeout/reconnect behavior and every method not executed |
| Wallet and signing | Public instance/static inventory; signing boundary; source examples; hover probe | No cryptographic audit; multisign, batch, sponsor and loan signature flows not executed here |
| Request models and mapping | tx selectors; account_nfts mapping; pagination mapping; source request union | Not every request combination tested against a server |
| Response models and mapping | tx/account_tx/base response source; error recovery; helper mapping | Binary/API-version response correctness and every response variant not fully exercised here |
| RPC supporting models | Static samples of account transaction entries, orderbook currency and pagination auxiliaries | No exhaustive runtime fixture set |
| Events and subscriptions | Full event-name/listener mapping; on/once compile probes; local ledger event dispatch | No live subscription streams or full protocol event fixture set |
| Transactions and validation | Root type inventory; Payment discriminant positive control; unsigned submission negative case | Most transaction validators and amendment combinations not executed |
| Transaction metadata | Node guards/model source; balance-change helper on a synthetic MPT node | No every-transaction metadata corpus |
| Ledger entry models | All 54 namespace exports inventoried; representative AccountRoot/MPToken and discriminant sources | Not all ledger variants exercised; namespace export count is not deep field behavioral coverage |
| Common protocol types | Amount/Currency/Balance, SponsorSignature and API version source | No exhaustive asset or amount invariant tests |
| Model helpers and flags | Flag conversion/parse declarations and metadata entry points inspected | Not all flag combinations executed |
| Conversion, codec and ledger utilities | decode/sign boundary; XRP precision; time unit source; balance changes; all 15 hashes members inventoried | Hash algorithms, every codec and normalization edge not independently verified |
| Address codecs (re-export) | Signature/static review: typed X-address result, explicit tag/test parameters | No independent codec cryptographic/protocol audit |
| Keypair utilities (re-export) | Public signatures and keypair types reviewed | No key derivation or cryptographic audit |
| Errors | All 12 class exports inventoried; hierarchy/source; RippledError narrowing probe and observed local errors | Full throw taxonomy not exhaustively exercised |
| Convenience helpers | validateSponsorship and its result type/source reviewed | No sponsored ledger workflow executed |
| Confidential MPT builders | All 24 root exports inventoried; parameter/discriminated-operation source; compile positive control | No live confidential workflow, proof-system or WASM interoperability audit |
| Other public exports | ECDSA enum inventoried and Wallet usage inspected | No additional runtime behavior claimed |

No family is represented as having comprehensive executed-workflow coverage. Other audit workstreams may provide deeper journey evidence; consolidate it without changing these local claims.

## Reproduction

From `audit/harness`, run:

```sh
node inventory-public-api.cjs
node inventory-surface-probes.cjs
node inventory-runtime-probes.cjs
```

The scripts do not modify the SDK or portal and do not contact a ledger. They emit the inventory, strict diagnostics/hover results and runtime results into `audit/evidence`. The generated `inventory-probes.ts` intentionally includes accepted invalid calls and expected compiler failures; it is an evidence fixture, not a production example.

Evidence files: [compiler and hover results](surface-probes.json), [offline runtime results](surface-runtime-probes.json), [full API inventory](api-inventory.json), [coverage summary](api-coverage.md).
