# `submitAndWait` resolves `tesSUCCESS` for a `Batch` whose inner transactions were all reverted; the `Batch` model, `submitAndWait` and `ParentBatchID` are undocumented and there is no helper to reach inner results

Severity: major
Category: docs

## Affected surface

- `Batch` interface — `packages/xrpl/src/models/transactions/batch.ts:57-68` (no description; only
  `@category`)
- `TransactionMetadataBase.ParentBatchID?: string` — `models/transactions/metadata.ts:92` (undocumented)
- `Client.submitAndWait` / `submit` docs — `client/index.ts` (`grep -n Batch` → 0 hits)
- What exists but is not pointed at: `hashSignedTx` accepts unsigned `tfInnerBatchTxn`
  transactions (`utils/hashes/hashLedger.ts:86-93`) precisely so inner hashes can be computed; the
  repo's own `test/integration/transactions/batch.test.ts:24-39` verifies each inner transaction
  separately

## Repro

Live (rippled 3.4.0-rc1, `audit/README.md` round-3 log; the [087](087-batch-autofill-off-by-one-under-ticketed-outer.md)
run): a `tfAllOrNothing` batch of two per-holder locks whose inner sequences were wrong:

```
submitAndWait(ticketed Batch) result   tesSUCCESS
holders locked after batch? a/b        false/false
```

`res.result.meta.TransactionResult === 'tesSUCCESS'`; nothing in the response says the two locks
did not happen. To learn that, the caller must compute each inner hash
(`hashes.hashSignedTx(inner)`), query `tx` for each, and interpret absence (all-or-nothing revert)
vs. a `tec*` result carrying `ParentBatchID` (independent / until-failure modes).

## Expected vs actual

Expected: `Batch` docs that state the outcome model (outer `tesSUCCESS` ≠ inner success; which
flags revert what; inner transactions appear as separate ledger transactions with
`ParentBatchID`), a `@remarks` on `submitAndWait`, and a helper such as
`getBatchInnerHashes(batch)` / `client.getBatchResults(outerHash)` returning
`{ hash, result | 'reverted' }[]`.

Actual: for "lock + claw back atomically" — the reason a compliance issuer reaches for Batch —
the SDK's success signal is meaningless and it says so nowhere. An operator logs "locked and clawed
back" on a no-op.

Round-4 addition: there is no dry run either — rippled's `simulate` answers `Not implemented.`
for every `Batch` (verified live for six shapes,
[099](099-validatebatch-misses-mode-flag-and-count-rules.md)), so the SDK's `client.simulate`
doc ([044](044-simulate-doc-copy-pasted-from-submit.md)) should say so.

## Root cause

Batch support was added at the model/signing level without an outcome story.

## Proposed fix

Docs (S) plus a helper (M):

```ts
export function getBatchInnerHashes(batch: Batch): string[] {
  return batch.RawTransactions.map((r) => hashes.hashSignedTx(r.RawTransaction))
}
// Client sugar
public async getBatchResults(outerHash: string): Promise<Array<{ hash: string; result: string | 'not-applied' }>>
```

and on `Batch`: "The outer transaction's `tesSUCCESS` only means the batch was processed. Under
`tfAllOrNothing` a failing inner transaction reverts all of them and none appears in the ledger;
under `tfIndependent`/`tfUntilFailure`/`tfOnlyOne` inner outcomes are separate validated
transactions whose metadata carries `ParentBatchID`."

## Workaround today

Compute inner hashes with `hashes.hashSignedTx` and query `tx` per inner transaction; treat
`txnNotFound` as reverted.

## References

- XLS-56 §Batch outcomes
- Related: [025](025-submitandwait-three-failure-surfaces-no-result-helper.md), [087](087-batch-autofill-off-by-one-under-ticketed-outer.md), [043](043-submitandwait-throws-doc-claims-tec-rejects.md)
