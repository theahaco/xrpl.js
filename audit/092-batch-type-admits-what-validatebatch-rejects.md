# The `Batch` type admits nested batches and inner `Fee`/`LastLedgerSequence`/`TxnSignature` that `validateBatch` rejects, and `Batch.Flags` does not accept `BatchFlagsInterface`

Severity: paper-cut
Category: types

## Affected surface

- `Batch.RawTransactions[].RawTransaction: SubmittableTransaction` — `packages/xrpl/src/models/transactions/batch.ts:66`
- Runtime rejections — `batch.ts:74-105` (`validateBatch`: no nested `Batch`, inner `Fee` must be
  `'0'`, no `LastLedgerSequence`, no `TxnSignature`/`Signers`, `SigningPubKey` must be `''`)
- `Batch.Flags` inherits `BaseTransaction.Flags?: number | GlobalFlagsInterface`;
  `BatchFlagsInterface` (`batch.ts:38`) is exported but not accepted

## Repro

Compiled (`tsc --strict`, `audit/README.md` round-3 log):

```ts
const b: Batch = { …, RawTransactions: [
  { RawTransaction: { TransactionType: 'Batch', Account, RawTransactions: [] } },                                   // compiles
  { RawTransaction: { TransactionType: 'MPTokenIssuanceSet', Account, MPTokenIssuanceID, Fee: '12', LastLedgerSequence: 5, TxnSignature: 'AB' } }, // compiles
] }
const c: Batch = { …, Flags: { tfAllOrNothing: true } }
// TS2353: Object literal may only specify known properties, and 'tfAllOrNothing' does not exist in type 'GlobalFlagsInterface'.
```

(The audit's own batch probe hit the `Flags` error first.)

## Expected vs actual

Expected: `RawTransaction: Exclude<SubmittableTransaction, Batch> & { Fee?: '0'; SigningPubKey?: '';
TxnSignature?: never; Signers?: never; LastLedgerSequence?: never }` and
`Flags?: number | BatchFlagsInterface`, matching every other transaction's flag typing.

Actual: the type is looser than the validator in one direction and stricter than the rest of the
SDK in the other; a batch of MPT lock/clawback transactions needs numeric `BatchFlags` and gets
no compile-time help on the inner-field rules.

## Root cause

`Batch` model added without a `Flags` override or an inner-transaction type.

## Proposed fix

Type-only, non-breaking for correct code:

```ts
export type BatchInnerTransaction = Exclude<SubmittableTransaction, Batch> & {
  Fee?: '0'; SigningPubKey?: ''; TxnSignature?: never; Signers?: never; LastLedgerSequence?: never
}
export interface Batch extends BaseTransaction {
  TransactionType: 'Batch'
  RawTransactions: Array<{ RawTransaction: BatchInnerTransaction }>
  BatchSigners?: BatchSigner[]
  Flags?: number | BatchFlagsInterface
}
```

## Workaround today

Use numeric `BatchFlags.tfAllOrNothing` and rely on `validate()` for the inner rules.

## References

- Related: [004](004-basetransaction-record-string-unknown-collapses-keyof.md), [088](088-batch-outcome-silent-no-inner-results.md)
