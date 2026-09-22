# Prototype correctness review

Reviewed actual modified SDK and portal source in the isolated audit worktrees. This review is of the proposed demonstration patch, not a claim that the prior open PRs are merged or released. Paths below are relative to their named worktree; lines refer to the reviewed local source and may move before publication.

## Findings and decisions

### R1 — High: preliminary `tel` / `tef` results were treated as final

The initially integrated PR45 code in `xrpl.js/packages/xrpl/src/sugar/submit.ts` classified all `tel*` and almost all `tef*` results as terminal, performed one transaction lookup, and threw `TransactionFailedError` if that lookup was not already validated. This could report a definitive failure while the transaction remained eligible for later validation. The same assumption appeared in comments and early-failure tests.

XRPL's [finality documentation](https://xrpl.org/docs/concepts/transactions/finality-of-results) distinguishes conditional finality from merely preliminary failure. In particular, `tefPAST_SEQ` requires validation of the competing sequence, and most other outcomes may still change. The [local-result documentation](https://xrpl.org/docs/references/protocol/transactions/transaction-results/tel-codes) says `telINSUF_FEE_P` transactions can be retained and retried by the server.

**Decision:** exclude PR45's new finality policy from this prototype. Restore the published npm `xrpl@5.3.0` polling order, expiry behavior, lookup-error behavior, and client-side `tem*` handling. The source of comparison is `audit/harness/node_modules/xrpl/src/sugar/submit.ts`. Remove the new terminal classifier and handler and tests expecting immediate `tel` / `tef` failure. Retain the distinct PR55 validated-response type, with the runtime guards described in R3.

Current implementation: `packages/xrpl/src/sugar/submit.ts:120` sleeps before polling; line124 retains the published expiry-before-lookup order; line131 performs the lookup. The prototype therefore **does not fix** the prior late-final-ledger lookup issue or preserve lookup-error subclasses, both of which require their own reviewed work. Do not claim full PR45 delivery. Its separately introduced errors/helpers may still exist unused in the aggregate patch.

### R2 — High: simulated response type preserved a pre-normalization transaction shape

The initially integrated generic `simulate` overload promised `SimulateJsonResponse<T>` while its new normalization converted flag objects into numbers and removed the `DeliverMax` alias. A strict TypeScript 5.9.3 in-memory probe accepted an MPT transaction with `Flags: { tfMPTLock: true }` and then accepted assigning `response.result.tx_json.Flags` to `{ tfMPTLock: boolean }`. The actual normalization would invalidate that claim. No probe file was persisted.

**Decision:** the public-API agent restored published `simulate` behavior and its non-transaction-generic response type. Current location: `packages/xrpl/src/client/index.ts:779`. Simulation redesign and normalization are excluded from the before/after claims; a later implementation would need a separately modeled normalized response type and runtime tests. The phantom `SignedBlob<T>` does not restore simulation inference in this prototype.

### R3 — Medium: validated-response promise needs consistent API shape and parsed metadata

`ValidatedTxResponse<T>` describes the API v2 response (`tx_json`) and decoded metadata. The initial implementation inherited mutable `client.apiVersion` for its internal `tx` request and used only `typeof meta === 'object'`, which also accepts `null`.

**Decision:** `packages/xrpl/src/sugar/submit.ts:135` explicitly requests `api_version: 2`; lines157–167 require `validated === true` and reject absent, null, hexadecimal, or array metadata before returning the specialized type. The guard distinguishes parsed metadata from the broad wire alternatives; it is not a full runtime validator for every metadata field or a proof of the submitted generic type.

**Compatibility:** even when a caller selects `client.apiVersion = 1`, the prototype's `submitAndWait` transaction lookup now requests v2. This keeps the promised response shape honest but is a runtime compatibility change for callers depending on a v1 result or servers lacking v2 support. It needs an explicit release decision; it must not be described as purely declaration-only. The lookup does not change the client's configured API version globally.

### R4 — Medium: strict transaction checking is not universal

`packages/xrpl/src/Wallet/index.ts:377` still accepts a generic transaction directly. An in-memory strict TypeScript probe accepted `wallet.sign({ TransactionType: 'Payment', Account: 'rFrom', Destination: 'rTo', Amount: '1', DestinationTagg: 12 })`. The optional phantom property at lines37–39 also permits an explicit annotation assigning an ordinary string to `SignedBlob<Payment>`. These observations are about compile-time assurances; the signing path has its own runtime validation.

**Disposition:** scope the report to the exact checked entry points. Do not describe `SignedBlob` as runtime validation or claim every transaction construction/signing path rejects misspelled properties. No additional signing-boundary redesign was made by this correction.

## Portal check

The proposed `_code-samples/devx-after` examples retain checks that type improvements cannot replace:

- `get-started.ts:45` and `send-xrp.ts:26` check the final transaction result.
- `issue-mpt-with-metadata.ts:45` and line85 check each final result; line49 retains the possibly absent issuance ID check; lines63 and96 retain optional ledger metadata checks.
- `create-amm.ts:7` checks each submitted transaction's own response, and line48 retains the unavailable validated-ledger check.
- All four CLI entrypoints disconnect in `finally`; exported journey functions leave connection ownership with their caller.

These are source-review conclusions, not claims of successful network execution. Runtime journey results belong in the separate execution evidence.

## Validation of the correction

- Original `test/client/submitAndWait.test.ts` malformed-transaction case retained.
- Focused regressions added for delayed validation after `tefPAST_SEQ` and `telINSUF_FEE_P`, retry after `txnNotFound`, explicit v2 lookup with a v1-configured client, malformed decoded-metadata alternatives, and a validated `tec` result remaining visible to the caller.
- Original integration tests restored, with direct decoded-metadata result assertions added. PR45-specific early-failure and reordered-finality expectations removed.
- Focused unit result: **10/10 passed**, one suite, 13.382 seconds, with local mock-server sockets permitted. Invocation: `jest --config=jest.config.unit.js --runInBand --coverage=false test/client/submitAndWait.test.ts` from `packages/xrpl`.
- The initial restricted run failed at mock-server socket setup (`listen EPERM`), before test behavior executed. A subsequent permitted run exposed a test-fixture issue: malformed hex was rejected by the existing client decoder before reaching the new metadata guard. The guard cases now mock the `client.request` result directly; the other cases exercise the existing mock-server path. The final permitted run above passed.
- Whole-suite and live-network validation are owned by the main audit thread and are not inferred from this focused result.
