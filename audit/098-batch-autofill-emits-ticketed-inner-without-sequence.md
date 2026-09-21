# `autofillBatchTxn` emits a ticketed inner transaction with no `Sequence` field at all; rippled rejects the whole batch at submission with `Field 'Sequence' is required but missing`

Severity: major
Category: runtime

## Affected surface

- `autofillBatchTxn` — `packages/xrpl/src/sugar/autofill.ts:621`
  (`if (txn.Sequence == null && txn.TicketSequence == null) { … }` — the ticket case falls through
  and nothing sets `Sequence = 0`)
- `validateBatch` / `validateBaseTransaction` — no cross-field rule (`common.ts:1015`)
- The rule the SDK documents elsewhere: `common.ts:729` ("If this is provided, Sequence must be
  0"); fixture `test/fixtures/requests/signTicket.json` (`"Sequence": 0, "TicketSequence": 23`)

## Repro

Live (rippled 3.4.0-rc1, `audit/README.md` round-4 log): `tfAllOrNothing` batch, inner[0] a
per-holder lock with `TicketSequence: 959`, inner[1] sequence-based:

```
autofilled: inner[0] { TicketSequence: 959 }  (no Sequence key)  | inner[1] Sequence: 962 | outer Sequence: 961
simulate(autofilled batch)  -> RPC error: Field 'Sequence' is required but missing.
submitAndWait(autofilled)   -> RippledError: Field 'Sequence' is required but missing.  (error: invalidTransaction)
holders locked? a/b         -> false/false
```

`sfSequence` is required by rippled's common transaction template; a ticketed transaction carries
`Sequence: 0`. Note the failure surface: `submitRequest` propagates the raw `RippledError` from
`submit` (`invalidTransaction`), a fifth shape on top of
[025](025-submitandwait-three-failure-surfaces-no-result-helper.md)'s three and
[063](063-polling-errors-rewrapped-as-plain-error-undefined.md)'s fourth.

This corrects the record in [086](086-autofill-injects-sequence-next-to-ticketsequence.md), which
cited this line as "where the SDK knows the rule": the inner path avoids injecting a live sequence
but does not emit the required `0`.

## Expected vs actual

Expected: `else if (txn.TicketSequence != null) txn.Sequence = 0`, mirroring the fix for
[086](086-autofill-injects-sequence-next-to-ticketsequence.md), so a batch can mix ticketed and
sequenced inner transactions (the pattern for "one pre-allocated emergency lock plus a normal
clawback").

Actual: with [086](086-autofill-injects-sequence-next-to-ticketsequence.md) (top level) and
[087](087-batch-autofill-off-by-one-under-ticketed-outer.md) (ticketed outer), every ticket
combination the sugar offers is broken; the only working ticket path is a top-level transaction
with `Sequence: 0` set by hand.

## Root cause

Ticket case handled as "skip" instead of "set zero".

## Proposed fix

Non-breaking, one line in `autofillBatchTxn` plus the `validateBaseTransaction` rule from
[086](086-autofill-injects-sequence-next-to-ticketsequence.md); add a ticketed-inner case to
`test/client/autofill.test.ts`.

## Workaround today

Set `Sequence: 0` on the ticketed inner transaction by hand before `autofill`.

## References

- Related: [086](086-autofill-injects-sequence-next-to-ticketsequence.md), [087](087-batch-autofill-off-by-one-under-ticketed-outer.md), [088](088-batch-outcome-silent-no-inner-results.md)
