# The exported `Amount` type excludes `MPTAmount` (stale "once MPTv2 is released" TODO), so helpers typed on `Amount` reject MPT values while the internal `isAmount` guard admits them

Severity: minor
Category: types

## Affected surface

- `Amount` — `packages/xrpl/src/models/common/index.ts:32-33`
  (`// TODO: add MPTAmount to Amount once MPTv2 is released` / `export type Amount = IssuedCurrencyAmount | string`)
- `isAmount` — `packages/xrpl/src/models/transactions/common.ts:418-424` (returns true for MPT
  amounts but is declared `amount is Amount`)
- Every field that had to be widened by hand: `Payment.Amount/DeliverMax/SendMax/DeliverMin`
  (`payment.ts:133-168`, `Amount | MPTAmount`), `TransactionMetadataBase.DeliveredAmount/delivered_amount`
  (`metadata.ts:86-88`), `ClawbackAmount` (`common/index.ts:35`)

## Repro

```ts
const mpt = { mpt_issuance_id: issuanceId, value: '1' }
const amount: Amount = mpt
// TS2322: Type '{ mpt_issuance_id: string; value: string; }' is not assignable to type 'Amount'.
```

Compiled repro `repros.ts` (`audit017`). Inside the SDK:

```ts
// models/transactions/common.ts:418
export function isAmount(amount: unknown): amount is Amount {
  return typeof amount === 'string' || isIssuedCurrencyAmount(amount) || isMPTAmount(amount)
}
```

so after `if (isAmount(x) && typeof x !== 'string')` the compiler believes `x.currency` is a
`string`, and it is `undefined` for an MPT amount.

## Expected vs actual

Expected: `Amount = string | IssuedCurrencyAmount | MPTAmount` (MPTokensV1 has been live on mainnet
since rippled 2.3; "MPTv2" is not a real gate), and the guard's predicate matches its runtime
behaviour.

Actual: any user helper written against `Amount` (formatting, balance-change accumulation,
`getBalanceChanges`-style code, form validation) silently cannot take MPT values; every SDK field
that carries an MPT amount is a hand-written `Amount | MPTAmount` union that can drift (and has: the
`ClawbackAmount` alias exists precisely because `Amount` was not widened). The unsound guard is
internal but is the reason `validatePayment` accepts an MPT `Amount` next to an XRP `SendMax`
(`probes.ts`: `Payment: MPT Amount + XRP SendMax | validate: ok | rippled: temMALFORMED`).

## Root cause

A TODO that was never resolved when MPT shipped; the guard was widened without widening the type.

## Proposed fix

Breaking in the sense that code narrowing `Amount` with `typeof x === 'string' ? … : x.currency`
gains a third case; mechanical for callers.

```ts
export type Amount = IssuedCurrencyAmount | MPTAmount | string
export type ClawbackAmount = IssuedCurrencyAmount | MPTAmount   // unchanged, now a subset
// payment.ts / metadata.ts: `Amount | MPTAmount` -> `Amount`
```

If a breaking change is unwanted, at least make `isAmount` honest
(`amount is Amount | MPTAmount`) and add `isTokenAmount` narrowing that callers can use.

## Workaround today

Use `Payment['Amount']` (which is already `Amount | MPTAmount`) as the "any amount" type in
application code.

## References

- `packages/xrpl/src/models/common/index.ts:32` (the TODO)
- Related: [016](016-mpt-amount-value-not-validated-no-scale-helper.md), [041](041-payment-validator-lacks-mpt-rules.md)
