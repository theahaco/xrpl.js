# `validatePayment` accepts `Account === Destination` with no `SendMax`/`Paths`; rippled rejects it as `temREDUNDANT`

Severity: paper-cut
Category: validation

## Affected surface

- `validatePayment` — `packages/xrpl/src/models/transactions/payment.ts:200-240`

## Repro

`npm run probes`:

```
Payment: MPT to self | validate: ok | rippled: temREDUNDANT
```

(The same holds for XRP and IOU self-payments without a cross-currency component; the MPT case is
the one the issuer project hit when a helper defaulted `Destination` to the sender.)

## Expected vs actual

Expected: `ValidationError('PaymentTransaction: Account and Destination must differ unless SendMax or Paths make it a currency conversion')`.

Actual: passes `validate()`; `submitAndWait` throws an `XrplError` with `temREDUNDANT` in prose
([025](025-submitandwait-three-failure-surfaces-no-result-helper.md)).

## Root cause

Rule missing from the validator.

## Proposed fix

Non-breaking:

```ts
if (tx.Account === tx.Destination && tx.SendMax === undefined && tx.Paths === undefined) {
  throw new ValidationError('PaymentTransaction: Account and Destination cannot be the same for a direct payment')
}
```

(rippled: `temREDUNDANT` when `account == dest` and not a cross-currency/cross-issue payment;
with `SendMax` it is a self-conversion and allowed for IOU/XRP but `temMALFORMED` for MPT.)

## Workaround today

Application-level check.

## References

- rippled `Payment::preflight` (`temREDUNDANT`)
- Related: [041](041-payment-validator-lacks-mpt-rules.md)
