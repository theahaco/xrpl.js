# `validatePayment` has no MPT-specific rules: an MPT `Amount` combined with `SendMax`, `Paths`, or a zero value passes `validate()` and fails on rippled

Severity: minor
Category: validation

## Affected surface

- `validatePayment` — `packages/xrpl/src/models/transactions/payment.ts:200-240`
- `checkPartialPayment` — `payment.ts:294-319` (does not know about MPT)
- `Payment` doc comments — `payment.ts:128-168` (`SendMax`: "Must be supplied for
  cross-currency/cross-issue payments" — never true for MPT)

## Repro

`npm run probes` (rippled 3.4.0-rc1):

```
Payment: MPT Amount + XRP SendMax                | validate: ok | rippled: temMALFORMED
Payment: MPT with Paths                          | validate: ok | rippled: temMALFORMED
Payment: MPT value "0"                           | validate: ok | rippled: temBAD_AMOUNT
Payment: MPT with tfPartialPayment               | validate: ok | rippled: tesSUCCESS   (allowed)
Payment: MPT Amount + DeliverMin, no partial flag| validate: ValidationError (caught)   | rippled: temBAD_AMOUNT
```

## Expected vs actual

Expected: the validator encodes XLS-33's payment rules: an MPT payment is always direct
(`Paths` forbidden; `SendMax`, if present, must be the same MPT — mixing with XRP/IOU is
`temMALFORMED`), `value` must be > 0, and `DeliverMin` (if present) must be the same MPT. Doc
comments on `SendMax`/`Paths` mention the MPT restriction.

Actual: all pass. Together with [017](017-amount-type-excludes-mptamount.md) (the type does not
distinguish MPT from other amounts) and [016](016-mpt-amount-value-not-validated-no-scale-helper.md)
(value unchecked) the MPT payment path has essentially no client-side validation beyond "is an
object with two string keys".

## Root cause

`validatePayment` predates MPT and was extended only in its types.

## Proposed fix

Non-breaking:

```ts
if (isMPTAmount(tx.Amount)) {
  if (tx.Paths !== undefined) throw new ValidationError('PaymentTransaction: Paths are not allowed for MPT payments')
  if (tx.SendMax !== undefined && !(isMPTAmount(tx.SendMax) && tx.SendMax.mpt_issuance_id === tx.Amount.mpt_issuance_id))
    throw new ValidationError('PaymentTransaction: SendMax must be the same MPT as Amount')
  if (tx.DeliverMin !== undefined && !(isMPTAmount(tx.DeliverMin) && tx.DeliverMin.mpt_issuance_id === tx.Amount.mpt_issuance_id))
    throw new ValidationError('PaymentTransaction: DeliverMin must be the same MPT as Amount')
  if (BigInt(tx.Amount.value) === 0n) throw new ValidationError('PaymentTransaction: MPT Amount must be positive')
}
```

## Workaround today

Application-level checks.

## References

- rippled `Payment::preflight` (MPT branch: `temMALFORMED` for paths / mixed SendMax, `temBAD_AMOUNT` for zero)
- XLS-33 §Payment
- Related: [016](016-mpt-amount-value-not-validated-no-scale-helper.md), [017](017-amount-type-excludes-mptamount.md), [040](040-payment-self-send-not-caught.md)
