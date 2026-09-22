# `autofillBatchTxn` adds `+1` to the outer account's inner `Sequence`s even when the outer `Batch` uses a ticket, so the issuer's inner transactions are off by one and the batch "succeeds" without doing anything

Severity: major
Category: runtime

## Affected surface

- `autofillBatchTxn` — `packages/xrpl/src/sugar/autofill.ts:631-634`
  (`const sequence = txn.Account === tx.Account ? nextSequence + 1 : nextSequence` — assumes the
  outer consumes a sequence number)
- A ticketed outer is a supported scenario elsewhere: `Wallet/batchSigner.ts:55-61`
  (`getBatchSeqValue`: `Sequence` 0 → bind `TicketSequence`)

## Repro

Live (rippled 3.4.0-rc1, `audit/README.md` round-3 log): issuer account `Sequence` 790, two
inner `MPTokenIssuanceSet` locks (holders a, b), `tfAllOrNothing`:

```
ticketed outer  (Sequence: 0, TicketSequence: 788): inner Sequences [791, 792]  -> submitAndWait: tesSUCCESS ; holders locked? a/b = false/false
Sequence outer  (Sequence: 790):                    inner Sequences [791, 792]  -> submitAndWait: tesSUCCESS ; holders locked? a/b = true/true
```

A ticketed outer does not advance the account's `Sequence`, so the inner transactions must start
at 790; the SDK emits 791, 792, both inner locks fail (`terPRE_SEQ`), `tfAllOrNothing` reverts
them — and the **outer Batch is still validated with `tesSUCCESS`** (see
[088](088-batch-outcome-silent-no-inner-results.md)).

## Expected vs actual

Expected: `nextSequence + (tx.TicketSequence == null ? 1 : 0)` for inner transactions from the
outer account.

Actual: an issuer that uses tickets for the outer Batch (the natural way to guarantee an atomic
lock + clawback goes out regardless of in-flight sequences) gets a batch that reports success and
changes nothing. Combined with [086](086-autofill-injects-sequence-next-to-ticketsequence.md), the
ticket path is broken at both levels.

## Root cause

The `+1` encodes "the outer transaction will consume a sequence" without checking how the outer
is sequenced.

## Proposed fix

Non-breaking:

```diff
-      const sequence = txn.Account === tx.Account ? nextSequence + 1 : nextSequence
+      const outerConsumesSequence = tx.TicketSequence == null
+      const sequence = txn.Account === tx.Account && outerConsumesSequence ? nextSequence + 1 : nextSequence
```

plus a unit test in `test/client/autofill.test.ts` (which has no `TicketSequence` case today).

## Workaround today

Set inner `Sequence`s by hand (`account_info.Sequence`, `+1` each for the outer account) when the
outer uses a ticket.

## References

- XLS-56 (Batch); rippled `Batch::doApply` (inner sequence checks)
- Related: [086](086-autofill-injects-sequence-next-to-ticketsequence.md), [088](088-batch-outcome-silent-no-inner-results.md)
