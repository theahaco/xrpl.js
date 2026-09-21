# `autofill` shallow-copies a `Batch` and writes `Sequence`/`Fee`/`SigningPubKey` into the caller's inner transaction objects, so retrying the same Batch object reuses stale inner sequences while the outer gets a fresh one — and the retry reports `tesSUCCESS` having done nothing

Severity: major
Category: runtime

## Affected surface

- `Client.autofill` — `packages/xrpl/src/client/index.ts:690` (`const tx = { ...transaction }`,
  shallow; `RawTransactions[i].RawTransaction` objects are shared with the caller)
- `autofillBatchTxn` — `packages/xrpl/src/sugar/autofill.ts:621-634` (writes `txn.Sequence`,
  `Fee`, `SigningPubKey`, `NetworkID` onto those shared objects; line 621 then skips any inner that
  already has a `Sequence`)
- Reached by every `submitAndWait(batch, { wallet })` via `sugar/submit.ts:255`

## Repro

Live (rippled 3.4.0-rc1, `audit/README.md` round-5 log). An unlock batch is autofilled once
(the operator's first attempt "times out"; only the autofill happened), an unrelated issuer
payment lands, then the operator retries **with the same object**:

```
first autofill of unlock batch: outer 1018, inner [1019, 1020]
caller object now carries inner Sequences [1019, 1020]        <- mutated
(issuer payment consumes 1018)
retry submitAndWait(same object): tesSUCCESS, outer 1019, inner [1019, 1020]   <- inner[0] == outer
locked a/b after "successful" unlock retry: true/true
```

Offline (stubbed client): after the first autofill the caller's object holds the inner
`Sequence`s and the same object references (`same refs: true`); a second autofill with the
account at 795 returns outer 795 and inner `[791, 792]`. A plain (non-Batch) transaction is not
mutated (`input.Sequence` stays `undefined`), so the Batch behaviour is the exception.

## Expected vs actual

Expected: `autofill` returns a filled copy and leaves the input alone, for inner transactions as
for the outer; a retry recomputes every sequence.

Actual: the retry path an operator is most likely to take after any of the timeout/expiry
failures in [025](025-submitandwait-three-failure-surfaces-no-result-helper.md),
[062](062-submitandwait-expiry-check-precedes-final-tx-lookup.md), [081](081-no-client-side-sequence-allocation-for-concurrent-submissions.md)
produces a batch that validates with `tesSUCCESS` and applies none of its inner transactions
(the [088](088-batch-outcome-silent-no-inner-results.md) mechanism). For an emergency freeze or
clawback this is the worst possible outcome: a green log line and no enforcement.

## Root cause

Shallow copy at `client/index.ts:690`; in-place writes in `autofillBatchTxn`; the "already has
Sequence → skip" rule then trusts the values it wrote last time.

## Proposed fix

Non-breaking:

```diff
-    const tx = { ...transaction }
+    const tx = { ...transaction }
+    if (tx.TransactionType === 'Batch') {
+      tx.RawTransactions = tx.RawTransactions.map((r) => ({ RawTransaction: { ...r.RawTransaction } }))
+    }
```

(a structured clone of `RawTransactions` is equally fine), and a unit test that autofills the
same Batch object twice.

## Workaround today

Rebuild the Batch object (or deep-clone it) before every `autofill`/`submitAndWait` call.

## References

- Related: [087](087-batch-autofill-off-by-one-under-ticketed-outer.md), [088](088-batch-outcome-silent-no-inner-results.md), [098](098-batch-autofill-emits-ticketed-inner-without-sequence.md), [101](101-batch-inner-sequences-ignore-caller-supplied-outer-sequence.md)
