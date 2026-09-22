# `Wallet.sign` runs `removeTrailingZeros` before `validate()`, so a malformed `Payment.Amount` throws a raw `TypeError`, and it rewrites MPT values (`"10.0"` → `10`) for `Payment` only

Severity: minor
Category: runtime

## Affected surface

- `Wallet.sign` — `packages/xrpl/src/Wallet/index.ts:403` (`removeTrailingZeros(tx)`) before `:409` (`validate(tx)`)
- `removeTrailingZeros` — `Wallet/index.ts:474-486` (`tx.TransactionType === 'Payment' && typeof tx.Amount !== 'string' && tx.Amount.value.includes('.') …`)

## Repro

Offline against the built package (`audit/README.md` round-2 log, verbatim):

```
validate(Payment missing Amount)          -> throws ValidationError: PaymentTransaction: missing field Amount
sign(Payment missing Amount)              -> throws TypeError: Cannot read properties of undefined (reading 'value')
sign(Payment MPT value as number 5)       -> throws TypeError: tx.Amount.value.includes is not a function

sign(Payment  MPT value "10.0") -> decoded 10          sign(Clawback MPT value "10.0") -> Error: 10.0 is an illegal amount
sign(Payment  MPT value "0.0")  -> decoded 0           sign(Clawback MPT value "0.0")  -> Error: 0.0 is an illegal amount
sign(Payment  MPT value "1.50") -> Error: 1.5 is an illegal amount   (the user never wrote "1.5")
```

## Expected vs actual

Expected: `validate()` runs first so the existing, correct `ValidationError` messages surface; the
MPT value grammar is the same for every transaction type; error text quotes the caller's input.

Actual: (1) a `TypeError` from inside the SDK hides a message the SDK already has; (2) the IOU
trailing-zero helper, which does not check `isMPTAmount`, silently canonicalises `"10.0"` to `10`
and `"0.0"` to `0` for MPT payments (the latter then fails on rippled with `temBAD_AMOUNT`) while
`Clawback` rejects the same strings — and rewrites `"1.50"` to `"1.5"` before the codec's error
message quotes it.

## Root cause

Ordering, plus an IOU-specific helper applied to a union that now includes MPT.

## Proposed fix

Non-breaking:

```diff
-    removeTrailingZeros(tx)
     validate(tx as unknown as Record<string, unknown>)
+    removeTrailingZeros(tx)
```

and in `removeTrailingZeros`: `if (isMPTAmount(tx.Amount)) return` (MPT values must already be
canonical integers, [016](016-mpt-amount-value-not-validated-no-scale-helper.md)).

## Workaround today

Call `validate(tx)` yourself before `sign`; never write decimals in MPT values.

## References

- Related: [016](016-mpt-amount-value-not-validated-no-scale-helper.md), [023](023-binary-codec-accepts-non-canonical-mpt-value-strings.md), [042](042-handledelivermax-compares-object-amounts-by-reference.md)
