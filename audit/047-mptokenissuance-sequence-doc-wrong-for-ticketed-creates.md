# `MPTokenIssuance.Sequence` is documented as "must match the account's current Sequence number"; for ticketed creates it is the `TicketSequence`, which changes the derived `MPTokenIssuanceID`

Severity: minor
Category: docs

## Affected surface

- `MPTokenIssuance.Sequence` doc — `packages/xrpl/src/models/ledger/MPTokenIssuance.ts:15-22`
- ID derivation described in [012](012-no-helper-to-derive-mpt-issuance-id-or-keylets.md) and
  implemented at `audit/mpt-issuer/src/ids.ts:24-35`

## Repro

`MPTokenIssuanceCreate` submitted with a ticket (`TicketSequence: 656`, `Sequence: 0`) on rippled
3.4.0-rc1 (`audit/README.md` round-2 log, verbatim):

```
ticketed create result: tesSUCCESS | tx Sequence: 0 TicketSequence: 656
meta.mpt_issuance_id:               000002903C04DBF7A93DD4C313A67484589329037F300D03
derived from tx.Sequence(0):        000000003C04DBF7A93DD4C313A67484589329037F300D03   (wrong)
derived from TicketSequence:        000002903C04DBF7A93DD4C313A67484589329037F300D03   (matches)
ledger MPTokenIssuance.Sequence: 656
```

Doc text (verbatim):

> A 32-bit unsigned integer that is used to ensure issuances from a given sender may only ever exist
> once, even if an issuance is later deleted. Whenever a new issuance is created, this value must
> match the account's current Sequence number.

## Expected vs actual

Expected: "The sequence number the creating transaction consumed: its `Sequence`, or its
`TicketSequence` when a ticket was used. Together with `Issuer` it forms the 192-bit
`MPTokenIssuanceID`."

Actual: an issuer that batches creates through tickets (the normal way to submit several
transactions per ledger) and pre-computes IDs from `tx.Sequence` gets IDs that do not exist. The
`ids.ts` helper in this audit had the same simplification until this test.

## Root cause

Doc written for the non-ticket case; rippled uses `tx.getSeqValue()` (ticket-aware).

## Proposed fix

Docs only, plus the helper in [012](012-no-helper-to-derive-mpt-issuance-id-or-keylets.md) should
take `tx.TicketSequence ?? tx.Sequence`.

## Workaround today

`deriveMPTokenIssuanceID(issuer, tx.TicketSequence ?? tx.Sequence)`.

## References

- rippled `MPTokenIssuanceCreate::doApply` (`tx.getSeqValue()`); `Transactor::getSeqValue`
- Related: [012](012-no-helper-to-derive-mpt-issuance-id-or-keylets.md)
