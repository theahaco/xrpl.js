# `Wallet.sign` lets interface-form `Flags` through `validate()` and then fails in the codec with `Error: Cannot construct UInt32 from given value`

Severity: minor
Category: runtime

## Affected surface

- `validate` — `packages/xrpl/src/models/transactions/transaction.ts:291,314` (converts `Flags` on a
  private copy `{ ...transaction }`)
- `Wallet.sign` — `packages/xrpl/src/Wallet/index.ts:409,414,436` (validates, then encodes the
  caller's original object, whose `Flags` is still an object)
- Contrast `Client.autofill` — `client/index.ts:693` (converts `Flags` in place)

## Repro

Offline (`audit/README.md` round-2 log):

```
validate(Set with interface Flags {tfMPTLock:true})   -> ok
sign(Set with interface Flags)                          -> throws Error: Cannot construct UInt32 from given value
```

Reached in practice via `client.submit(tx, { wallet, autofill: false })`, `client.submitAndWait(tx,
{ wallet, autofill: false })`, or any offline signing flow — i.e. exactly the flows where the
developer supplies `Sequence`/`Fee` themselves. With `autofill: true` the object form works, so the
failure appears only when the second option is flipped.

## Expected vs actual

Expected: `Flags` typed as `number | XFlagsInterface` is honoured everywhere the type is accepted;
`sign` either converts (one call to `convertTxFlagsToNumber`, which `validate` already performs on
its copy) or rejects with a `ValidationError` saying "convert flags first".

Actual: a codec `Error` with no field or transaction name, from a value the SDK's own validator
just accepted.

Round-3 extension (sweep j, verified live): the `autofill` workaround does not cover Batch inner
transactions — `Client.autofill` converts only the outer `Flags` (`client/index.ts:694`);
`autofillBatchTxn` (`sugar/autofill.ts:617-665`) leaves inner `Flags: { tfInnerBatchTxn: true,
tfMPTUnlock: true }` as an object, so `submitAndWait(batch, { wallet })` (autofill on) still ends
in `Error: Cannot construct UInt32 from given value`.

Round-7 addition (verified offline): the same "outer-only normalisation" applies to `DeliverMax` —
`autofill` rewrites it into `Amount` on a top-level `Payment` only; an inner `Payment` carrying
`DeliverMax` is left alone, so `Wallet.sign` fails with `PaymentTransaction: missing field Amount`
and `encode` with `Field DeliverMax is not defined`.

## Root cause

`validate` mutates a copy; `sign` encodes the original.

## Proposed fix

Non-breaking:

```ts
// Wallet/index.ts, before encode
const txToSign = { ...tx, Flags: convertTxFlagsToNumber(tx) }   // or mutate, like autofill does
```

## Workaround today

`tx.Flags = convertTxFlagsToNumber(tx)` before signing, or always autofill.

## References

- Related: [030](030-simulate-does-not-thread-transaction-type.md) (same object-Flags gap in `simulate`), [037](037-mpt-validators-do-not-check-flag-masks.md)
