# Consolidated finding register

This register organizes **12 SDK groups and 6 portal groups** supported by the current audit artifacts. One SDK group is a design opportunity, and several groups have source-only evidence. These are reporting units, **not 18 demonstrated runtime bugs**, and must not be added to the historical 107 claims or the eight surface evidence headings. Eleven historical IDs overlap some current evidence; individual matching scope is recorded below.

Baseline: published **xrpl 5.3.0**, TypeScript **5.9.3**; tracked portal commit **87b3007547539741d99425f43a0796802c834fc3**. [npm provenance](npm-baseline.json) records the package integrity. Pre-existing untracked portal adaptations are excluded from published-portal findings.

**Publication:** [aha audit branch](https://github.com/theahaco/xrpl.js/tree/aha/devx-audit-2026-09/devx-audit). Existing issue/PR links identify prior work; proposed fixes remain unreleased. All linked prior proposals were OPEN in the captured inventory.

## Suggested report narrative

xrpl.js already provides useful transaction discriminants and correctly inferred ordinary event handlers. The strongest recurring weakness is the loss of guidance between steps: published declarations hide documentation, permissive inputs accept typos, prepared/signed transactions lose useful types, and specific queries return broad answers. Existing portal examples compound those gaps with assertions, any and uneven outcome handling. The current evidence supports a practical package-consumer quality program combining truthful types, informative editor guidance and maintained executable examples.

The audit also found independent areas to address: inconsistent event registration, pagination, exact-value conversion and public-MPT balance reporting. Their evidence is local and bounded; the report should not turn those probes into claims about production losses or every protocol combination.

## Priority order

1. Restore shipped declaration documentation and correct the source examples it will expose (DX-01, DX-12). Demonstrate the result from the packed consumer package.
2. Make the ordinary request and transaction journey teach through types, preserve inference and reject typos with useful diagnostics (DX-02–DX-04, DX-07). Reuse and review existing aha proposals rather than count them as newly invented work.
3. Fix the reproduced event safety gap and clarify MPT balance/precision limitations (DX-05, DX-10, DX-11); verify candidate behavior with targeted runtime fixtures.
4. Make maintained portal journeys check their own outcomes, keep prepared objects and handle empty results (PORT-01–PORT-06). Treat legacy examples and guided replacements distinctly; verify protocol-sensitive payment lessons on a matching isolated ledger.
5. Standardize pagination and error recovery; consider a validated decoder as separately scoped design work (DX-06, DX-08, DX-09).

## Evidence and severity rules

- **High** means broad loss of the agreed editor guidance, reproducible type-safety failure, or a misleading example/helper result with material consequences if relied on. **Medium** means bounded friction, inconsistent support, a representation limitation or a design gap with a workaround. These are DevX priorities, not security ratings or prevalence measurements.
- Compiler evidence establishes accepted/rejected programs. Offline runtime, mock pagination, synthetic metadata, source inspection and live-ledger execution are different proof levels; each row names its level.
- This register reviewed other workstreams' recorded evidence; it did not rerun their probes. Mitigations are recommendations. Current implementation status must be verified separately in the main report.
- Newly observed relative to the prior corpus means no exact root-cause match was identified in the retained 107-document corpus. It is not a claim of global novelty.
- Historical protocol deny-list limitations and Batch outcome semantics are contextual constraints. Intermediate harness/setup or disabled-amendment failures are excluded from SDK defect evidence.
- Positive controls matter: valid Payment construction, required Payment fields, ordinary inferred on callbacks, broad-query unions and binary-query separation have useful behavior to preserve.

## Register at a glance

| ID | Finding | Priority | Evidence | Historical relationship |
|---|---|---|---|---|
| DX-01 | Published declarations strip developer guidance from editor hovers | high | language service and artifact inspection | No exact match in prior corpus |
| DX-02 | Default transaction and request types allow misspelled fields | high | strict compiler | Prior 004, 055; [#7](https://github.com/theahaco/xrpl.js/issues/7), [#8](https://github.com/theahaco/xrpl.js/issues/8) |
| DX-03 | Transaction lifecycle operations discard information they already know | high | strict compiler | Prior 001, 002, 033; [#5](https://github.com/theahaco/xrpl.js/issues/5) |
| DX-04 | Literal query selectors do not guide response types | high | strict compiler | Prior 005, 007, 078; [#4](https://github.com/theahaco/xrpl.js/issues/4) |
| DX-05 | Event payload safety depends on listener-registration style | high | strict compiler and local runtime | No exact match in prior corpus |
| DX-06 | Pagination support and defaults disagree across helpers | medium | strict compiler local runtime and mock | No exact match in prior corpus |
| DX-07 | Types permit ordinary calls that violate local preconditions | medium | strict compiler and local preflight | No exact match in prior corpus |
| DX-08 | RPC error classification still requires application-invented guards | medium | strict compiler and source | Prior 035; [#22](https://github.com/theahaco/xrpl.js/issues/22) |
| DX-09 | Decoded data has no obvious validated path back to a typed transaction | medium | strict compiler and source | No exact match in prior corpus |
| DX-10 | Balance-change helper omits public MPT changes | high | synthetic metadata runtime and source | Prior 053; [#23](https://github.com/theahaco/xrpl.js/issues/23) |
| DX-11 | Number-returning XRP conversion is not exact for large values | medium | direct runtime | No exact match in prior corpus |
| DX-12 | Shipped source examples contain stale or internally inconsistent calls | medium | source inspection | Prior 048; [#28](https://github.com/theahaco/xrpl.js/issues/28) |
| PORT-01 | TypeScript examples sometimes bypass the type guidance they teach | medium | tracked source and compiler review | No exact match in prior corpus |
| PORT-02 | Examples can continue or report progress without verifying the right outcome | high | tracked source inspection | No exact match in prior corpus |
| PORT-03 | Paths example discards the prepared transaction before signing | high | tracked source inspection | No exact match in prior corpus |
| PORT-04 | Query examples assume a nonempty result | medium | tracked source and stricter compiler | No exact match in prior corpus |
| PORT-05 | Payment-channel example does not demonstrate a verified authorized claim | high | tracked source inspection protocol execution pending | No exact match in prior corpus |
| PORT-06 | Partial-payment lesson omits explicit delivered-amount interpretation | high | tracked source inspection | No exact match in prior corpus |

## DX-01 — Published declarations strip developer guidance from editor hovers

**High · sdk · distribution defect**

All 447 inventoried named root symbols lack compiler-visible JSDoc prose in the installed declaration graph; source has prose for 344. Four actual package-consumer hovers (Client constructor, Client.request, Wallet.generate, xrpToDrops) return signatures without documentation.

**Impact:** Developers lose existing parameter guidance and examples at the point of use across the package. This directly undermines the agreed goal that the API should teach through the editor.

**Evidence:** language service and artifact inspection.
- [evidence/surface-probes.json](surface-probes.json) — quickInfo. Reproduce or inspect: [harness/inventory-surface-probes.cjs](../harness/inventory-surface-probes.cjs).
- [evidence/api-inventory.json](api-inventory.json) — 447 named root symbols; documentation coverage. Reproduce or inspect: [harness/inventory-public-api.cjs](../harness/inventory-public-api.cjs).

**Prior relationship:** No exact match in prior corpus. No exact numbered prior claim matched this group.
Thematically related, not counted as reproduced: 008, 013, 044, 048, 050, 051.

**Limits:**
- The inherited Client.on hover contains EventEmitter prose; this is not a claim that every possible hover is blank.
- Presence of source comments does not establish correctness of those comments.

**Mitigation:** Preserve JSDoc in published declarations; check hovers and completion documentation against the packed npm consumer artifact, then correct stale examples (DX-12).

**Acceptance evidence:** Re-run inventory and TypeScript language-service quickInfo probes against the exact packed candidate package.

## DX-02 — Default transaction and request types allow misspelled fields

**High · sdk · type model defect**

Payment DestinationTagg and request ledger_indx typos compile in annotated literals and ordinary submission/request calls. Omit<Payment,'Account'> also accepts a value missing other required Payment fields.

**Impact:** Ordinary editor workflows fail to flag locally knowable mistakes; utility-type composition loses required-field guarantees. Current probes establish acceptance, not a specific on-ledger loss.

**Evidence:** strict compiler.
- [evidence/journey-baseline.json](journey-baseline.json) — J02,J03,J04,J14,J15. Reproduce or inspect: [harness/probe-journeys.mjs](../harness/probe-journeys.mjs).

**Prior relationship:** Prior 004, 055; [#7](https://github.com/theahaco/xrpl.js/issues/7), [#8](https://github.com/theahaco/xrpl.js/issues/8). Prior 004 keyof/Omit/typo behavior and the index-signature half of 055; missing lookup members and broad Partial headline are not reverified.
Existing proposed fixes: [PR #46](https://github.com/theahaco/xrpl.js/pull/46) (OPEN; `fm/xrpljs-strict-transaction-types-f05`), [PR #51](https://github.com/theahaco/xrpl.js/pull/51) (OPEN; `fm/xrpljs-strict-request-types-f06`). Proposed implementation/test claims require independent review.
Thematically related, not counted as reproduced: 061.

**Limits:**
- J02/J03/J04/J14/J15 use placeholders and were compiled, not submitted.
- Do not generalize this result to every utility type; Partial behavior was not the demonstrated defect.

**Mitigation:** Make ordinary request/transaction surfaces strict while preserving explicit forward-compatible boundaries. Test direct generic calls as well as satisfies annotations and require useful typo diagnostics.

**Acceptance evidence:** Run the listed positive and negative compiler probes before and after the proposed strictness changes.

## DX-03 — Transaction lifecycle operations discard information they already know

**High · sdk · type model defect**

autofill does not expose newly populated Fee/LastLedgerSequence for an inferred literal; object Flags remain an object statically. submitAndWait metadata retains string/undefined alternatives. Signing to a plain blob loses issuance-specific metadata typing.

**Impact:** The prepare→sign→confirm workflow repeatedly forces workarounds and re-establishment of facts the library already knows, creating opportunities to hide errors with assertions.

**Evidence:** strict compiler.
- [evidence/journey-baseline.json](journey-baseline.json) — J05,J09,J10,J16. Reproduce or inspect: [harness/probe-journeys.mjs](../harness/probe-journeys.mjs).

**Prior relationship:** Prior 001, 002, 033; [#5](https://github.com/theahaco/xrpl.js/issues/5). Prior 001/002/033 reproduced as declaration behavior; no claim to have rerun prior 030 simulate behavior.
Existing proposed fixes: [PR #55](https://github.com/theahaco/xrpl.js/pull/55) (OPEN; `fm/xrpljs-submit-path-typing-f03`). Proposed implementation/test claims require independent review.
Thematically related, not counted as reproduced: 030.

**Limits:**
- Compiler behavior is verified; these probes do not prove ledger execution fails.
- Current-release simulate normalization and every prior lifecycle claim were not reproduced by this evidence.

**Mitigation:** Return truthful autofilled and validated-result types and preserve a transaction's identity across signed blobs. Replace normalized Flags rather than intersecting incompatible field types. Keep plain-string fallback honest.

**Acceptance evidence:** Compile the full journey with literal and explicitly typed input, object/numeric/absent Flags, signed blobs and plain strings.

## DX-04 — Literal query selectors do not guide response types

**High · sdk · type model defect**

MPT issuance and account-root lookups return the full LedgerEntry union; account_objects type:'offer' does not select Offer; explicit api_version:1 still returns a v2-shaped type.

**Impact:** Developers must cast or manually narrow responses even after making the narrowing choice in the request. Wrong version typing also suggests fields absent from the chosen response format.

**Evidence:** strict compiler.
- [evidence/journey-baseline.json](journey-baseline.json) — J06,J07,J08,J11; positive controls J12,J13. Reproduce or inspect: [harness/probe-journeys.mjs](../harness/probe-journeys.mjs).

**Prior relationship:** Prior 005, 007, 078; [#4](https://github.com/theahaco/xrpl.js/issues/4). Prior 005/007/078 literal-selector/version inference; no automatic stream metadata correlation claim.
Existing proposed fixes: [PR #53](https://github.com/theahaco/xrpl.js/pull/53) (OPEN; `fm/xrpljs-response-narrowing-f02`). Proposed implementation/test claims require independent review.
Thematically related, not counted as reproduced: 006, 058.

**Limits:**
- Current probes cover these selectors, not all RPC variants.
- Broad stored requests and binary requests correctly retain safe behavior in J12/J13 and must stay protected.
- Nested event-discriminant narrowing is a related prior claim, not established here.

**Mitigation:** Map literal selectors, filters and API version to response variants; preserve unions for broad inputs and separate binary responses. Require inference without a caller assertion.

**Acceptance evidence:** Run literal, variable, broad-union, API-version and binary compiler cases against candidate declarations.

## DX-05 — Event payload safety depends on listener-registration style

**High · sdk · type safety defect**

on('ledgerClosed', (ledger:string)=>ledger.toUpperCase()) compiles and then throws on a locally emitted ledger object. An inherited once callback receives any and accepts a nonexistent member; ordinary inferred on correctly rejects that member.

**Impact:** A small registration-style change silently removes editor safety, while an explicitly wrong callback is accepted and produces a reproducible runtime TypeError.

**Evidence:** strict compiler and local runtime.
- [evidence/surface-probes.json](surface-probes.json) — event-on-inference,event-on-wrong-listener,event-once-inference. Reproduce or inspect: [harness/inventory-surface-probes.cjs](../harness/inventory-surface-probes.cjs).
- [evidence/surface-runtime-probes.json](surface-runtime-probes.json) — event-on-wrong-listener. Reproduce or inspect: [harness/inventory-runtime-probes.cjs](../harness/inventory-runtime-probes.cjs).

**Prior relationship:** No exact match in prior corpus. No exact numbered prior claim matched this group.
Thematically related, not counted as reproduced: 058.

**Limits:**
- Runtime proof uses local event dispatch, not a live ledger stream.
- This is not the same root cause as prior stream transaction/metadata correlation finding 058.

**Mitigation:** Use one event-to-argument map across on, once and aliases; reject incompatible callbacks while preserving contextual inference.

**Acceptance evidence:** Compile both registration styles and dispatch representative local event payloads; preserve ordinary-on negative controls.

## DX-06 — Pagination support and defaults disagree across helpers

**Medium · sdk · api consistency defect**

request supports account_nfts, requestNextPage rejects it, and requestAll accepts it without collect but immediately throws. A two-page fake connection shows omitted limit fetches both pages, contradicting the source claim of one request.

**Impact:** Developers cannot compose the same supported request with paging helpers consistently and may make more requests than source guidance promises.

**Evidence:** strict compiler local runtime and mock.
- [evidence/surface-probes.json](surface-probes.json) — nft-pagination-next,nft-pagination-all. Reproduce or inspect: [harness/inventory-surface-probes.cjs](../harness/inventory-surface-probes.cjs).
- [evidence/surface-runtime-probes.json](surface-runtime-probes.json) — nft-pagination-all,pagination-default-multiple-pages. Reproduce or inspect: [harness/inventory-runtime-probes.cjs](../harness/inventory-runtime-probes.cjs).

**Prior relationship:** No exact match in prior corpus. No exact numbered prior claim matched this group.
Thematically related, not counted as reproduced: 079.

**Limits:**
- Two-page behavior is a mock result, not a live-server failure.
- Prior finding 079 concerns normalization/warnings; it is related but not this paging defect.

**Mitigation:** Unify supported command/collection mappings; require collect when needed and correct the default-limit documentation. Consider a typed async iterator as separately scoped design work.

**Acceptance evidence:** Compile supported command permutations and test explicit/omitted collect and limit using bounded multi-page fixtures.

## DX-07 — Types permit ordinary calls that violate local preconditions

**Medium · sdk · type model defect**

TxRequest accepts neither identifier or both transaction and ctid despite its exactly-one source contract. A visibly unsigned Payment compiles without a wallet and immediately fails submission preflight.

**Impact:** Developers discover errors after invoking the API that the editor could have explained while constructing the request.

**Evidence:** strict compiler and local preflight.
- [evidence/surface-probes.json](surface-probes.json) — tx-missing-identifier,tx-conflicting-identifiers,unsigned-submit-no-wallet. Reproduce or inspect: [harness/inventory-surface-probes.cjs](../harness/inventory-surface-probes.cjs).
- [evidence/surface-runtime-probes.json](surface-runtime-probes.json) — unsigned-submit-no-wallet. Reproduce or inspect: [harness/inventory-runtime-probes.cjs](../harness/inventory-runtime-probes.cjs).

**Prior relationship:** No exact match in prior corpus. No exact numbered prior claim matched this group.
Thematically related, not counted as reproduced: 004, 055.

**Limits:**
- Tx selector expectations were checked against the shipped source contract, not a live-server rejection.
- Runtime state, authorization and amendment availability cannot generally be proven by TypeScript.

**Mitigation:** Model exclusive request selectors and signed-versus-unsigned submission states. Preserve explicitly flexible entrypoints where justified.

**Acceptance evidence:** Compile neither/either/both selector cases and signed blob/signed object/unsigned draft submissions with and without wallet.

## DX-08 — RPC error classification still requires application-invented guards

**Medium · sdk · type model gap**

After instanceof RippledError, error.data remains unknown, so accessing error.data.error fails type checking despite the request manager constructing the subclass from RPC responses.

**Impact:** Routine not-found and other RPC recovery paths require repeated structural guards or assertions instead of a documented typed accessor.

**Evidence:** strict compiler and source.
- [evidence/surface-probes.json](surface-probes.json) — error-discovery. Reproduce or inspect: [harness/inventory-surface-probes.cjs](../harness/inventory-surface-probes.cjs).

**Prior relationship:** Prior 035; [#22](https://github.com/theahaco/xrpl.js/issues/22). Prior 035 RPC error data typing only; unrelated polling wrappers are not reproduced.
Existing proposed fixes: [PR #38](https://github.com/theahaco/xrpl.js/pull/38) (OPEN; `fm/xrpljs-rpc-additions-f20`). Proposed implementation/test claims require independent review.
Thematically related, not counted as reproduced: 025, 063, 069.

**Limits:**
- Retaining unknown for arbitrary external payloads is appropriate; the requested improvement is checked access to recognized RPC fields.
- Other prior polling/error-taxonomy claims are not reverified here.

**Mitigation:** Provide validated RPC error-code/data accessors or a truthful typed RPC subclass while retaining unknown for unclassified data.

**Acceptance evidence:** Compile instanceof-based recovery and execute accessors on valid, partial and malformed RPC error payloads.

## DX-09 — Decoded data has no obvious validated path back to a typed transaction

**Medium · sdk · design opportunity**

decode(encode(payment)) returns Record<string,unknown>, which cannot be passed directly to Wallet.sign. The inspected public path does not teach how to validate/narrow it into a transaction.

**Impact:** Consumers handwrite a guard or use an assertion at an important data boundary; a named validated decoder would make the safe path easier to discover.

**Evidence:** strict compiler and source.
- [evidence/surface-probes.json](surface-probes.json) — decode-sign-roundtrip. Reproduce or inspect: [harness/inventory-surface-probes.cjs](../harness/inventory-surface-probes.cjs).

**Prior relationship:** No exact match in prior corpus. No exact numbered prior claim matched this group.
Thematically related, not counted as reproduced: 004, 061.

**Limits:**
- A general decoder returning unknown data is defensible and is not itself a bug.
- This is a design opportunity, not proof that every decoded object should be trusted or that sign should accept arbitrary records.

**Mitigation:** Add a validated transaction decoder or a public assertion/guard with useful narrowed output; avoid caller-selected generics that make unchecked promises.

**Acceptance evidence:** Validate transaction versus ledger/metadata blobs and malformed shapes, then compile the guarded sign path.

## DX-10 — Balance-change helper omits public MPT changes

**High · sdk · runtime coverage defect**

A synthetic ModifiedNode for MPToken with MPTAmount changing from 10 to 25 yields an empty getBalanceChanges result; source implementation covers AccountRoot and RippleState, while prose promises every changed balance.

**Impact:** Applications relying on the broad helper description can omit public MPT activity from their views or accounting. Severity is high for that dependency, not a claim that all applications are affected.

**Evidence:** synthetic metadata runtime and source.
- [evidence/surface-runtime-probes.json](surface-runtime-probes.json) — mpt-balance-change-coverage. Reproduce or inspect: [harness/inventory-runtime-probes.cjs](../harness/inventory-runtime-probes.cjs).

**Prior relationship:** Prior 053; [#23](https://github.com/theahaco/xrpl.js/issues/23). Prior 053 reproduced with synthetic public MPToken metadata; prior 077 getBalances and confidential balances excluded.
Existing proposed fixes: [PR #50](https://github.com/theahaco/xrpl.js/pull/50) (OPEN; `fm/xrpljs-balance-helpers-mpt-f21`). Proposed implementation/test claims require independent review.
Thematically related, not counted as reproduced: 077, 017.

**Limits:**
- The probe is synthetic metadata, not a recorded live transaction.
- No confidential-balance coverage claim is made.
- Prior getBalances omission 077 was not independently reproduced by this probe.

**Mitigation:** Clarify XRP/trustline scope immediately; introduce a typed public-MPT balance representation and node handling, tested against captured ledger fixtures.

**Acceptance evidence:** Add captured Modified/Created/Deleted MPToken metadata cases, mixed asset changes and zero holdings before claiming complete support.

## DX-11 — Number-returning XRP conversion is not exact for large values

**Medium · sdk · numeric representation limitation**

dropsToXrp('9007199254740991') returns 9007199254.740992, and xrpToDrops of that result is '9007199254740992', one drop above the input.

**Impact:** Large-value round trips through JavaScript numbers can alter the represented amount. Users needing exact accounting need an explicit exact-value path.

**Evidence:** direct runtime.
- [evidence/surface-runtime-probes.json](surface-runtime-probes.json) — amount-precision-roundtrip. Reproduce or inspect: [harness/inventory-runtime-probes.cjs](../harness/inventory-runtime-probes.cjs).

**Prior relationship:** No exact match in prior corpus. No exact numbered prior claim matched this group.
Thematically related, not counted as reproduced: 096.

**Limits:**
- The demonstrated value is very large; do not imply ordinary small values universally lose precision.
- No real transaction or loss of funds was observed.
- Prior UInt64 codec precision finding 096 is a different boundary.

**Mitigation:** Offer exact string/decimal conversions and balance accessors with an explicit migration strategy for number-returning APIs.

**Acceptance evidence:** Round-trip decimal boundary values and preserve exact strings through balance-change reporting; document limits of numeric convenience APIs.

## DX-12 — Shipped source examples contain stale or internally inconsistent calls

**Medium · sdk · documentation defect**

Wallet example calls absent signTransaction; submitAndWait example omits awaiting/destructuring funded wallets, uses undefined names and demonstrates submit; requestAll example uses transaction_data outside the public Request union.

**Impact:** Restoring documentation delivery alone would surface examples that misteach the public workflow or cannot be copied as written.

**Evidence:** source inspection.
- [evidence/surface-findings.md](surface-findings.md) — SURF-08; published Wallet source line60, Client lines474/819/830. Reproduce or inspect: [harness/node_modules/xrpl/src/Wallet/index.ts](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/Wallet/index.ts).
- [evidence/surface-findings.md](surface-findings.md) — SURF-08; requestAll and submitAndWait source examples. Reproduce or inspect: [harness/node_modules/xrpl/src/client/index.ts](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/client/index.ts).

**Prior relationship:** Prior 048; [#28](https://github.com/theahaco/xrpl.js/issues/28). Prior 048 stale submitAndWait/sign examples overlap; Wallet class and requestAll details extend the current static inspection.
Existing proposed fixes: [PR #39](https://github.com/theahaco/xrpl.js/pull/39) (OPEN; `fm/xrpljs-client-and-ledger-docs-f26`). Proposed implementation/test claims require independent review.
Thematically related, not counted as reproduced: 044.

**Limits:**
- These particular source snippets were inspected, not executed as standalone live examples.
- Published declarations currently strip this guidance; the source inaccuracies and the distribution defect are distinct.

**Mitigation:** Use compiled public-package snippets as the shared source for hovers and portal examples; correct names and make each snippet demonstrate the advertised method.

**Acceptance evidence:** Extract and compile each maintained example against the packed package, with deterministic runtime checks where the lesson depends on outcomes.

## PORT-01 — TypeScript examples sometimes bypass the type guidance they teach

**Medium · portal · example type guidance gap**

Tracked AMM library imports xrpl with untyped require and accepts any clients/wallets/metadata; Get Started uses a double assertion for validate and redundant response annotations. Handwritten nullable token/request shapes further weaken the intended guidance.

**Impact:** A .ts extension and successful compilation give a misleading impression of checked SDK usage. Readers inherit assertions and custom scaffolding instead of learning usable public types and inference.

**Evidence:** tracked source and compiler review.
- [evidence/portal-review.md](portal-review.md) — P-01,P-02,P-04,P-06; baseline 87b3007547539741d99425f43a0796802c834fc3. Reproduce or inspect: [evidence/portal-tracked-baseline/_code-samples/create-amm/ts/lib/amm.ts](portal-tracked-baseline/_code-samples/create-amm/ts/lib/amm.ts).
- [evidence/portal-baseline-compile.json](portal-baseline-compile.json) — all seven families compile. Reproduce or inspect: [evidence/portal-tracked-baseline/_code-samples/get-started/ts/get-acct-info.ts](portal-tracked-baseline/_code-samples/get-started/ts/get-acct-info.ts).

**Prior relationship:** No exact match in prior corpus. No exact numbered prior claim matched this group.
Thematically related, not counted as reproduced: 004, 005, 001.

**Limits:**
- Seven tracked families compile under their own configs; compilation alone does not prove type safety when any is present.
- Local pre-existing untracked TS adaptations are excluded from this finding.
- Not every annotation or guard is unnecessary.

**Mitigation:** Teach literal input guidance, imported Client/Wallet/public models and inferred responses; keep necessary runtime guards explicit and explain current SDK workarounds.

**Acceptance evidence:** Compile strict public-package consumers, review for any/assertion escapes, and test intended invalid edits—not only clean compilation.

## PORT-02 — Examples can continue or report progress without verifying the right outcome

**High · portal · example outcome and lifecycle defect**

AMM trust-line handling reads issuer_setup_result metadata instead of trust_result, and issuance checks a previous transaction's result variable. Other examples log inclusion/balances without checking the current transaction result; several exception paths skip disconnect and Get Started does not observe its subscription promise.

**Impact:** Tutorial users can copy a workflow that logs misleading success, continues after failed setup or leaves connections open. The wrong-variable checks are directly visible in tracked source.

**Evidence:** tracked source inspection.
- [evidence/portal-review.md](portal-review.md) — P-03,P-05,P-11,P-13,P-16,P-17. Reproduce or inspect: [evidence/portal-tracked-baseline/_code-samples/create-amm/ts/lib/amm.ts](portal-tracked-baseline/_code-samples/create-amm/ts/lib/amm.ts).
- [evidence/portal-review.md](portal-review.md) — P-16 reliable submission line74; P-03 Get Started line85. Reproduce or inspect: [evidence/portal-tracked-baseline/_code-samples/reliable-tx-submission/js/reliableTransactionSubmission.ts](portal-tracked-baseline/_code-samples/reliable-tx-submission/js/reliableTransactionSubmission.ts).

**Prior relationship:** No exact match in prior corpus. No exact numbered prior claim matched this group.
Thematically related, not counted as reproduced: 025, 043.

**Limits:**
- These old paths were not executed with injected failures in this workstream.
- Ledger inclusion and transaction success are distinct protocol facts; that distinction itself is not an SDK defect.
- Cleanup and outcome problems are grouped as one tutorial lifecycle theme and should not be counted again per file.

**Mitigation:** Check parsed metadata for each corresponding result, stop on failed setup, await subscriptions, and use explicit connection ownership/finally cleanup.

**Acceptance evidence:** Inject resolved tec failures and rejected requests at every stage; verify no false success or subsequent dependent action, and verify cleanup.

## PORT-03 — Paths example discards the prepared transaction before signing

**High · portal · example preparation defect**

Paths calls await client.autofill(tx) without keeping the returned object, then wallet.sign(tx) on the original. The SDK autofill implementation returns a new transaction object.

**Impact:** The example fails to carry required preparation into signing and teaches the wrong mutation model for a core workflow.

**Evidence:** tracked source inspection.
- [evidence/portal-review.md](portal-review.md) — P-14. Reproduce or inspect: [evidence/portal-tracked-baseline/_code-samples/paths/js/paths.ts](portal-tracked-baseline/_code-samples/paths/js/paths.ts).
- [evidence/surface-findings.md](surface-findings.md) — published Client autofill source contract. Reproduce or inspect: [harness/node_modules/xrpl/src/client/index.ts](https://github.com/theahaco/xrpl.js/blob/f79b82c906a6379b51bc08cb64eb1bef2557d77e/packages/xrpl/src/client/index.ts).

**Prior relationship:** No exact match in prior corpus. No exact numbered prior claim matched this group.
Thematically related, not counted as reproduced: 033.

**Limits:**
- No failing live Paths execution is claimed here.
- This is an example-use defect, distinct from SDK autofill return typing (DX-03).

**Mitigation:** Store const prepared = await client.autofill(tx) and sign prepared; make return-value ownership clear in the tutorial.

**Acceptance evidence:** Offline test that the object passed to sign has Fee/Sequence/LastLedgerSequence; then execute against a controlled funded route.

## PORT-04 — Query examples assume a nonempty result

**Medium · portal · example empty result defect**

Get Transaction treats an empty transactions array as truthy and uses its first item. Paths uses alternatives[0] without a no-route branch; strict plus noUncheckedIndexedAccess produces TS2532 at that access.

**Impact:** Normal empty-ledger or unavailable-route states become undefined inputs or property errors instead of an explained tutorial outcome.

**Evidence:** tracked source and stricter compiler.
- [evidence/portal-strict-baseline-compile.json](portal-strict-baseline-compile.json) — paths/js TS2532 at paths.ts:35. Reproduce or inspect: [evidence/portal-tracked-baseline/_code-samples/paths/js/paths.ts](portal-tracked-baseline/_code-samples/paths/js/paths.ts).
- [evidence/portal-review.md](portal-review.md) — P-10,P-15. Reproduce or inspect: [evidence/portal-tracked-baseline/_code-samples/get-tx/js/getTransaction.ts](portal-tracked-baseline/_code-samples/get-tx/js/getTransaction.ts).

**Prior relationship:** No exact match in prior corpus. No exact numbered prior claim matched this group.

**Limits:**
- Only Paths produced the captured stricter compiler diagnostic; Get Transaction is a separate source observation.
- Hardcoded account liquidity and all route failures were not exercised.

**Mitigation:** Check for a first element, explain no-result outcomes, and use reproducible funded accounts/liquidity for the route example.

**Acceptance evidence:** Execute with empty transaction/alternative arrays and with one valid entry; require strict indexed-access checks for maintained examples.

## PORT-05 — Payment-channel example does not demonstrate a verified authorized claim

**High · portal · example protocol guidance gap**

Tracked source labels Amount:'100' as 10 XRP; derives a channel ID with Sequence??0; constructs a destination claim with Amount but no Balance or signed claim fields; uses submit then immediately prints post-claim balances without checking a validated outcome.

**Impact:** Readers are not shown an end-to-end verified channel claim and are taught inconsistent units and optimistic completion. The unit mismatch and missing validation wait are source-confirmed.

**Evidence:** tracked source inspection protocol execution pending.
- [evidence/portal-review.md](portal-review.md) — P-07,P-08,P-09. Reproduce or inspect: [evidence/portal-tracked-baseline/_code-samples/claim-payment-channel/js/claimPayChannel.ts](portal-tracked-baseline/_code-samples/claim-payment-channel/js/claimPayChannel.ts).

**Prior relationship:** No exact match in prior corpus. No exact numbered prior claim matched this group.

**Limits:**
- No server rejection or actual payout failure was reproduced; exact authorization behavior requires protocol and ledger confirmation.
- Do not describe absence of a Balance field alone as proof the transaction is always invalid; distinguish a payout claim from other channel operations.

**Mitigation:** Use explicit XRP-to-drops conversion, derive the real created channel, generate/verify the intended authorized payout claim, and wait for validated success before balance conclusions.

**Acceptance evidence:** Run creation, authorized payout and deliberately invalid authorization cases on an isolated ledger; verify exact delivered amount and channel state.

## PORT-06 — Partial-payment lesson omits explicit delivered-amount interpretation

**High · portal · example payment interpretation gap**

The example sends a Payment with tfPartialPayment and prints the response and balances, but does not check TransactionResult or explicitly read and explain delivered_amount where it demonstrates confirmation.

**Impact:** The lesson misses the critical distinction between a requested maximum and the amount actually delivered. Severity reflects the consequence if readers reuse that interpretation in payment processing, not an observed exploit.

**Evidence:** tracked source inspection.
- [evidence/portal-review.md](portal-review.md) — P-12. Reproduce or inspect: [evidence/portal-tracked-baseline/_code-samples/partial-payment/js/partialPayment.ts](portal-tracked-baseline/_code-samples/partial-payment/js/partialPayment.ts).

**Prior relationship:** No exact match in prior corpus. No exact numbered prior claim matched this group.
Thematically related, not counted as reproduced: 043, 057.

**Limits:**
- No funds loss or deployed application vulnerability was observed.
- The generic Get Transaction sample does explain delivered_amount; the gap is in this specific partial-payment lesson.

**Mitigation:** Check current validated result, explain/read delivered_amount, and handle unavailable and amount-kind cases explicitly before reporting receipt.

**Acceptance evidence:** Use controlled partial-delivery metadata and a ledger scenario where delivered amount is less than requested; assert the lesson reports actual delivery.

## Reconciliation checks

- Every referenced current artifact and reproduction/inspection file exists locally.
- Every exact prior claim reference resolves to the retained corpus; related IDs are labeled separately.
- Partial overlap for prior 055 maps only the request-strictness half to issue #8, not the distinct missing-lookup work in issue #6.
- No new stable report URL, implementation completion, live-ledger outcome or global novelty claim was fabricated.
