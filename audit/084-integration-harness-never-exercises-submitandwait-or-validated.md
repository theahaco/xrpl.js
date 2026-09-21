# The integration harness never goes through `submitAndWait`, never asserts `validated`, and for expected `tec*` results returns the preliminary `submit` code, so the `submitAndWait` bugs were untestable by the MPT suite

Severity: minor
Category: test-infra

## Affected surface

- `testTransaction` — `packages/xrpl/test/integration/utils.ts:272-322` (`client.submit` →
  `ledgerAccept` → `tx`; `:295-298`: `if (errCode) { assert.equal(errCode, engine_result); return response }`
  — no ledger close, no final result)
- `verifySubmittedTransaction` — `utils.ts:220-255` (does not check `validated`; tolerates `meta` as a
  string at `:250-254`; rewrites `Amount`→`DeliverMax` at `:230-235` under
  `// TODO: handle this API change for 2.0.0`)
- `grep -rln submitAndWait packages/xrpl/test/integration` → only `submitAndWait.test.ts` (one
  `AccountSet`) and `sponsorship.test.ts` (which races it with `ledger_accept`)

## Repro

Every "expected failure" case in the MPT suite (`mptokenIssuanceSet.test.ts:197-203, 258-264,
308-314, 371-377, 453-459`, `confidentialMPTSend.test.ts:285, 319`) asserts the *preliminary*
`engine_result` of `submit` and returns before any ledger closes; no MPT test ever calls
`submitAndWait`. This audit's `scenario.ts` runs the same lifecycle through `submitAndWait` with a
400 ms ledger closer and hit [062](062-submitandwait-expiry-check-precedes-final-tx-lookup.md)
(false "expired" on a validated payment) and [001](001-submitandwait-meta-string-undefined.md) on
the first day.

## Expected vs actual

Expected: at least one path in the harness (ideally `testTransaction` itself, with a background
`ledger_accept` ticker like `audit/mpt-issuer/src/session.ts`) uses `submitAndWait`, asserts
`result.validated === true`, and for `tec*` cases reads the *final* `meta.TransactionResult`.

Actual: the public "do it right" API is exercised by one test; the `Amount`→`DeliverMax` TODO in
the harness is the same gap as [057](057-payment-amount-required-but-v2-readback-has-delivermax.md);
and preliminary-`tec` assertions would keep passing if rippled changed the validated outcome.

## Root cause

Harness predates `submitAndWait`; standalone mode's manual ledger closing made `submit` +
`ledger_accept` the path of least resistance.

## Proposed fix

Test-infra only: add a `LEDGER_TICK_MS` background closer to `setupClient`, switch
`testTransaction` to `submitAndWait`, assert `validated`, and for `errCode` cases assert on the
validated `meta.TransactionResult`. That alone would have reproduced 062 in CI.

## Workaround today

None needed for users.

## References

- Related: [062](062-submitandwait-expiry-check-precedes-final-tx-lookup.md), [001](001-submitandwait-meta-string-undefined.md), [057](057-payment-amount-required-but-v2-readback-has-delivermax.md), [019](019-integration-test-docs-stale.md)
