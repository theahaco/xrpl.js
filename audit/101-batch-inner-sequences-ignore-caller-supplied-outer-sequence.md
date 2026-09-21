# `autofillBatchTxn` derives the outer account's inner `Sequence`s from `account_info`, ignoring a caller-supplied outer `Sequence`, so pre-assigned (pipelined) batches get inner sequences that are already in the past

Severity: major
Category: runtime

## Affected surface

- `autofillBatchTxn` — `packages/xrpl/src/sugar/autofill.ts:627-634`
  (`const nextSequence = await getNextValidSequenceNumber(client, txn.Account)`;
  `txn.Account === tx.Account ? nextSequence + 1 : nextSequence` — `tx.Sequence` never consulted;
  `accountSequences` at `:615` seeded only by autofilled inners)
- `Client.autofill` runs `setNextValidSequenceNumber` and `autofillBatchTxn` in parallel
  (`client/index.ts:698,712`), so even the autofilled outer value is not available to the inner logic

## Repro

Offline (stubbed client, `account_info.Sequence = 790`, `audit/README.md` round-5 log):

```
outer Sequence 800 supplied by caller -> autofill: outer 800, inner [791, 792]     (expected 801, 802)
```

Pre-assigning `Sequence` is the documented way to pipeline several transactions from one
account without tickets (xrpl.org "Reliable Transaction Submission") and the workaround
[081](081-no-client-side-sequence-allocation-for-concurrent-submissions.md) points at. When the
outer applies at 800, inner 791/792 are in the past → both inner transactions fail and, per the
live evidence in [087](087-batch-autofill-off-by-one-under-ticketed-outer.md)/[088](088-batch-outcome-silent-no-inner-results.md),
the outer still validates `tesSUCCESS` with nothing applied.

## Expected vs actual

Expected: inner sequences for the outer account are `(tx.Sequence ?? nextSequence) + 1 …`, i.e.
anchored to the outer's actual sequence, whether supplied or autofilled.

Actual: anchored to the live `account_info` value; the same `+1` line as
[087](087-batch-autofill-off-by-one-under-ticketed-outer.md), a different defect (087's fix,
`outerConsumesSequence`, does not change this result).

## Root cause

Inner and outer sequence assignment are independent code paths run concurrently.

## Proposed fix

Non-breaking: run `autofillBatchTxn` after the outer's `Sequence` is settled and anchor to it:

```ts
const outerSeq = tx.Sequence ?? (await getNextValidSequenceNumber(client, tx.Account))
… const sequence = txn.Account === tx.Account ? outerSeq + (tx.TicketSequence == null ? 1 : 0) + k : nextSequence
```

(`k` = index among the outer account's inner transactions), plus a unit test with a
caller-supplied outer `Sequence`.

## Workaround today

Set every inner `Sequence` by hand when pre-assigning the outer.

## References

- xrpl.org "Reliable Transaction Submission" (pre-assigned sequences)
- Related: [081](081-no-client-side-sequence-allocation-for-concurrent-submissions.md), [087](087-batch-autofill-off-by-one-under-ticketed-outer.md), [100](100-autofill-mutates-inner-batch-transactions-stale-retry.md)
