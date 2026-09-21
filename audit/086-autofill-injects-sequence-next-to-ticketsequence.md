# `Client.autofill` injects the account's live `Sequence` next to a caller-supplied `TicketSequence`, and `validate()` has no cross-field rule, so every ticketed submission through the sugar reaches rippled as `temSEQ_AND_TICKET`

Severity: major
Category: runtime

## Affected surface

- `Client.autofill` — `packages/xrpl/src/client/index.ts:697-699`
  (`if (tx.Sequence == null) { promises.push(setNextValidSequenceNumber(this, tx)) }` — no `TicketSequence` gate)
- `setNextValidSequenceNumber` — `packages/xrpl/src/sugar/autofill.ts:256-262`
- `validateBaseTransaction` — `models/transactions/common.ts:991,1015` (`Sequence`, `TicketSequence` each `isNumber`; no "non-zero Sequence with TicketSequence" rule)
- Contrast, where the SDK knows the rule: inner-Batch path `autofill.ts:621`
  (`if (txn.Sequence == null && txn.TicketSequence == null)`), `Wallet/batchSigner.ts:60`
  (`transaction.TicketSequence ?? 0`), fixture `test/fixtures/requests/signTicket.json`
  (`"Sequence": 0, "TicketSequence": 23`), `BaseTransaction.TicketSequence` doc ("If this is
  provided, Sequence must be 0")

## Repro

Live (rippled 3.4.0-rc1, `audit/README.md` round-3 log): issuer holds tickets 787–789.

```ts
const filled = await client.autofill({ ...holderLockTx(id, issuer, banned), TicketSequence: 787 })
```

```
autofill(ticketed, no Sequence) -> { Sequence: 790, TicketSequence: 787 }
simulate(autofilled ticketed tx) -> temSEQ_AND_TICKET
simulate(same with Sequence: 0)  -> tesSUCCESS
```

Through `submitAndWait` the failure is the `tem*` `XrplError` of
[025](025-submitandwait-three-failure-surfaces-no-result-helper.md). Found independently by two
sweeps (j and the round-3 dry run); the ticketed create in
[047](047-mptokenissuance-sequence-doc-wrong-for-ticketed-creates.md) only worked because that
test set `Sequence: 0` by hand.

## Expected vs actual

Expected: when `TicketSequence` is present, `autofill` sets `Sequence = 0` (as its inner-Batch
path effectively does), and `validate()` rejects a non-zero `Sequence` alongside `TicketSequence`.

Actual: `autofill` manufactures the conflicting field. Pre-allocated tickets are the standard way
for an issuer to fire an emergency lock or clawback regardless of in-flight sequence numbers
([081](081-no-client-side-sequence-allocation-for-concurrent-submissions.md)); the default sugar
path cannot submit one.

## Root cause

The top-level autofill predates tickets; the inner-Batch path was written later with the rule.

## Proposed fix

Non-breaking:

```diff
-    if (tx.Sequence == null) {
-      promises.push(setNextValidSequenceNumber(this, tx))
-    }
+    if (tx.Sequence == null) {
+      if (tx.TicketSequence == null) promises.push(setNextValidSequenceNumber(this, tx))
+      else tx.Sequence = 0
+    }
```

and in `validateBaseTransaction`: `if (tx.TicketSequence != null && tx.Sequence != null && tx.Sequence !== 0) throw new ValidationError('BaseTransaction: Sequence must be 0 when TicketSequence is provided')`.

## Workaround today

Set `Sequence: 0` explicitly on every ticketed transaction.

## References

- rippled `Transactor::preflight1` (`temSEQ_AND_TICKET`)
- Related: [047](047-mptokenissuance-sequence-doc-wrong-for-ticketed-creates.md), [081](081-no-client-side-sequence-allocation-for-concurrent-submissions.md), [087](087-batch-autofill-off-by-one-under-ticketed-outer.md)
