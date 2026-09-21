# `Client.autofill` returns the input type, so `Sequence`, `Fee`, `LastLedgerSequence` stay optional after autofill has populated them

Severity: minor
Category: types

## Affected surface

- `Client.autofill<T extends SubmittableTransaction>(transaction: T, …): Promise<T>` —
  `packages/xrpl/src/client/index.ts:685-736`
- `BaseTransaction.Sequence?/Fee?/LastLedgerSequence?/SigningPubKey?` — `models/transactions/common.ts:670-`

## Repro

```ts
const filled = await client.autofill(createTx)
const seq: number = filled.Sequence
// TS2322: Type 'number | undefined' is not assignable to type 'number'.
```

Compiled repro `repros.ts` (`audit033`). Hit at `audit/mpt-issuer/src/issue.ts:88-93`, where the
issuer needs the autofilled `Sequence` to pre-compute the `MPTokenIssuanceID`
([012](012-no-helper-to-derive-mpt-issuance-id-or-keylets.md)) and has to guard a value autofill
guarantees.

## Expected vs actual

Expected: `autofill` returns `T & Autofilled` where
`Autofilled = { Sequence: number; Fee: string; LastLedgerSequence: number; Flags?: number }`
(and `NetworkID` when applicable) — the fields the function documents itself as filling.
`Flags` in particular is converted from the interface form to a number by `autofill`
(`setTransactionFlagsToNumber`-style), so the object-form union is also gone after the call.

Actual: the same optional-everything `T`, so every consumer of an autofilled transaction writes
`!` or a guard, and the flags union persists.

## Root cause

Generic pass-through signature.

## Proposed fix

Non-breaking (the intersection is assignable to `T`):

```ts
export type Autofilled<T extends SubmittableTransaction> = T & {
  Sequence: number
  Fee: string
  LastLedgerSequence: number
  Flags?: number
}
public async autofill<T extends SubmittableTransaction>(transaction: T, signersCount?: number, …): Promise<Autofilled<T>>
```

`TicketSequence` users keep `Sequence: 0`, which still satisfies `number`.

## Workaround today

Guard after autofill (`if (filled.Sequence === undefined) throw …`).

## References

- `packages/xrpl/src/sugar/autofill.ts` (`setNextValidSequenceNumber`, `calculateFeePerTransactionType`, `setLatestValidatedLedgerSequence`)
- Related: [012](012-no-helper-to-derive-mpt-issuance-id-or-keylets.md)
