# Portal example review

Baseline: `xrpl-dev-portal` commit `87b3007547539741d99425f43a0796802c834fc3`; published `xrpl` 5.3.0; TypeScript 5.9.3. Date: 2026-09-22. This is a source and compiler audit, not a measured developer study. The root audit may add isolated-ledger execution separately.

## Coverage and findings

All seven tracked TypeScript families were inspected. All compile under their existing configs against 5.3.0. Enabling strict + noUncheckedIndexedAccess exposes the Paths missing-alternative check; the other six still compile. This illustrates why compilation alone is not a complete DevX or correctness check. Baseline compiler outputs are retained as JSON.

### get-started

Depth: source+baseline compile+improved compile. Change: revised Node and browser.

- **P-01 (medium)**, `_code-samples/get-started/ts/get-acct-info.ts:71`: A double assertion bypasses the typed boundary; the prose incorrectly equates local validation with server checks. satisfies Payment retains object shape; validate(payment) compiles without assertion; docs distinguish local constraints from ledger state.
- **P-02 (medium)**, `_code-samples/get-started/ts/get-acct-info.ts:53`: Redundant response and Wallet annotations obscure the SDK inference developers should learn to rely on. Remove response/Wallet annotations and use typed object guidance at the input.
- **P-03 (high)**, `_code-samples/get-started/ts/get-acct-info.ts:85`: Subscription promise is unobserved, result code is not checked, and exceptions before the delayed disconnect can leave connections open. Await subscription; inspect transaction result; finally disconnect; only report success after tesSUCCESS.

### create-amm

Depth: source+baseline compile+guided compile. Change: guided example added; broad original retained.

- **P-04 (high)**, `_code-samples/create-amm/ts/lib/amm.ts:1`: The SDK and client/wallet parameters become any, removing editor guidance despite a .ts extension and strict compiler config. New guided AMM uses SDK imports, typed wallets/clients, public transaction/amount types and inferred responses.
- **P-05 (high)**, `_code-samples/create-amm/ts/lib/amm.ts:733`: Trust-line and issuance steps consult metadata from earlier transactions; multiple catches log errors and continue. Guided journey checks each submission independently and propagates failures before continuing.
- **P-06 (medium)**, `_code-samples/create-amm/ts/lib/amm.ts:7`: Custom nullable token shapes need non-null assertions and hide the public Amount/Currency models; request command is widened to string. Guided journey demonstrates XRP drops versus issued amount as the SDK union; literal request uses satisfies AMMInfoRequest.

### claim-payment-channel

Depth: source+baseline compile. Change: reviewed; no edits.

- **P-07 (medium)**, `_code-samples/claim-payment-channel/js/claimPayChannel.ts:31`: Comment misstates drops by five orders of magnitude; 100 drops is 0.0001 XRP, not 10 XRP. Use xrpToDrops with an explicit XRP amount.
- **P-08 (high)**, `_code-samples/claim-payment-channel/js/claimPayChannel.ts:68`: The example claims from the destination without a signed channel claim or Balance, then reads balances without waiting for validation; success is not checked. Rework around a valid authorized claim and tesSUCCESS; use validated results before balance conclusions. Runtime behavior not exercised in this audit.
- **P-09 (medium)**, `_code-samples/claim-payment-channel/js/claimPayChannel.ts:62`: A missing sequence silently becomes zero when deriving the channel ID. Require/derive the actual creation sequence or retrieve the created channel from validated metadata.

### get-tx

Depth: source+baseline compile. Change: reviewed; no edits.

- **P-10 (medium)**, `_code-samples/get-tx/js/getTransaction.ts:19`: An empty transaction array is truthy; the following transactions[0] can be undefined. Check for an available first hash and show the empty-ledger outcome.
- **P-11 (medium)**, `_code-samples/get-tx/js/getTransaction.ts:41`: Request/metadata errors bypass disconnect. Own the connection in a finally block.

### partial-payment

Depth: source+baseline compile. Change: reviewed; no edits.

- **P-12 (high)**, `_code-samples/partial-payment/js/partialPayment.ts:87`: The partial-payment teaching example prints the response/balances but never explicitly explains or reads delivered_amount at the point where the user learns to confirm delivery. Check tesSUCCESS and show delivered_amount, including unavailable and amount-kind handling; distinguish requested maximum from actual delivery.
- **P-13 (medium)**, `_code-samples/partial-payment/js/partialPayment.ts:95`: Setup/issuance failures are not checked and exceptions skip cleanup. Stop on failed setup transactions; finally disconnect.

### paths

Depth: source+baseline compile+strict diagnostic. Change: reviewed; no edits.

- **P-14 (high)**, `_code-samples/paths/js/paths.ts:46`: The returned prepared transaction is discarded and the original is signed. The SDK returns a new object. const prepared = await client.autofill(tx); wallet.sign(prepared).
- **P-15 (medium)**, `_code-samples/paths/js/paths.ts:35`: Assumes at least one route for hardcoded external accounts; strict/noUncheckedIndexedAccess catches the unchecked first element. Handle no alternatives explicitly and use reproducible funded accounts/liquidity.

### reliable-tx-submission

Depth: source+baseline compile. Change: reviewed; no edits.

- **P-16 (high)**, `_code-samples/reliable-tx-submission/js/reliableTransactionSubmission.ts:74`: Reports validation and balances without checking the transaction result; ledger inclusion can be a tec failure. Check parsed metadata.TransactionResult before declaring payment success.
- **P-17 (medium)**, `_code-samples/reliable-tx-submission/js/reliableTransactionSubmission.ts:80`: Exceptions can bypass connection cleanup. Use finally and failing process status.

## Local pre-existing MPT work (separate from tracked baseline)

The original working tree contained an untracked MPT TypeScript adaptation and shared `ts-utils`. They were retained in a local reference snapshot, excluded from this published package; the original tree was not modified. Its package scripts point to absent `issue-token.ts` and `list-account-tokens.ts`. The update branch uses `if (is_success(updateResponse))` before warning of failure and exiting. Helpers `tx`, `meta`, `mptIssuanceId`, and `is_success` expose application-side scaffolding that could instead be addressed by SDK signatures and checked accessors. These observations must not be attributed to the published portal or its maintainers.

## Implemented demonstrations

- Get Started Node/browser: input `satisfies`, inferred responses, no double cast, owned Testnet destination, checked result, observed subscription promise, and unconditional cleanup. Browser output uses textContent. Runtime CDN and compiler package both pin 5.3.0.
- MPT: standalone strict TS issuance/lookup/update/confirm, metadata field guidance, named create flags, real parsed-metadata/issuance-ID/ledger-kind checks, and matching scripts. DynamicMPT-dependent updates stay explicit.
- Send XRP: prepare → sign the returned object → submit → check result, with two fresh wallets. 5.3.0 needs `autofill<Payment>` to expose `Fee`; this is documented as a workaround, not an SDK fix.
- Create AMM: new guided FOO/XRP issuance/create/query workflow using public types and independently checked submissions; old broad example retained and clearly excluded from the guided quality claim.
- Four English tutorials reference the improved source, setup and inference lessons. Their 66 code-snippet paths and walkthrough tags were checked. Realm built 2626 pages with zero errors, and the four edited tutorial routes were verified in a browser. See preview-status.md.

All four Node workflows export `run(client, funded wallets...)` without running network code at import time. CLI entrypoints own connection/funding/cleanup and allow XRPL_SERVER override. Browser Get Started remains a browser-native script. The caller of an exported run() owns connection cleanup.

## Verification and limits

- `portal-baseline-compile.json`: seven baseline config compilations passed against published 5.3.0.
- `portal-strict-baseline-compile.json`: strict/noUncheckedIndexedAccess check fails only the Paths first-alternative access.
- `portal-improved-compile.json`: four improved families compile (Get Started includes Node/browser).
- No `any`, unsafe assertions, or generic request overrides in new/rewritten workflow source; Send XRP explicit transaction generic remains necessary for current autofill typing.
- Network tests and editor interaction measurement must be reported separately. Local docs preview passed; remote hosting remains conditional. No upstream issue, PR, or deploy was created by this reviewer.
- Four remaining old families plus legacy Create AMM are findings, not remediated implementations. A passing current SDK compile does not prove their workflows execute or that their package-declared older dependency range behaves identically.

## Unreleased SDK comparison

The separate `_code-samples/devx-after/` package contains four matched workflows checked against the built aha SDK prototype, with runtime dependency also pointing at that local fork. All four compile. Default public examples remain pinned to published 5.3.0. `prototype-example-diffs.md` provides exact excerpts and narrowly scoped scaffold counts; `portal-prototype-examples.patch` supplies full pairwise differences.

Direct typed-object submission already preserves issuance-specific metadata in 5.3.0. The comparison does not count that as a new capability. New demonstrated gains are populated autofill fields, parsed validated metadata, dependent MPT ledger lookup types, and Payment type preservation through a signed blob. Every transaction-success and optional-domain-value check remains.

The strict request prototype exposed a missing `LookupByLedgerRequest` extension on `AMMInfoRequest`. The SDK audit added the extension; the guided AMM request now compiles without dropping its valid `ledger_index` selector. This is an example of the broader impact of removing permissive request index signatures and why representative examples must be checked alongside SDK changes.
