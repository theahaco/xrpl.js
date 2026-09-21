# `handleDeliverMax` compares `Amount` and `DeliverMax` with `!==`, so two structurally equal MPT (or IOU) amounts are rejected as "not identical"; `Amount` is also typed required although `DeliverMax`-only works

Severity: minor
Category: runtime

## Affected surface

- `handleDeliverMax` — `packages/xrpl/src/sugar/autofill.ts:585-600`
  (`if (tx.Amount != null && tx.Amount !== tx.DeliverMax) throw new ValidationError(…)`)
- `Client.autofill` — `client/index.ts:714-716` (calls it for every `Payment` with `DeliverMax`)
- `Payment.Amount: Amount | MPTAmount` (required), `DeliverMax?: …` — `models/transactions/payment.ts:133-135`

## Repro

Against the running node (`audit/README.md` "Round 1 log", one-off `autofill` probe):

```
XRP Amount == DeliverMax (strings)              -> autofill ok; Amount = "5", DeliverMax removed
MPT Amount === DeliverMax (same object)         -> autofill ok
MPT Amount deep-equal DeliverMax (two objects)  -> throws ValidationError: PaymentTransaction: Amount and DeliverMax fields must be identical when both are provided
MPT DeliverMax only (Amount absent, cast needed)-> autofill ok; Amount populated from DeliverMax
```

## Expected vs actual

Expected: "identical" means structurally equal (`mpt_issuance_id` + `value`, or
`currency` + `issuer` + `value`, with numeric equality of `value`), which is how
`client/partialPayment.ts:31-63` (`amountsEqual`) already compares amounts in the same package.
And since `DeliverMax` is the API-v2 name of `Amount`, a `Payment` with only `DeliverMax` should
type-check (it is the documented v2 form and autofill supports it).

Actual: reference equality; anything that reads a payment from JSON (or builds `DeliverMax` from a
copy) fails on the first non-XRP payment. `DeliverMax`-only needs an `as unknown as Payment` cast
because `Amount` is required in the type (the repo's own test does `// @ts-expect-error --
DeliverMax is a non-protocol, RPC level field` at `payment.test.ts:86`).

## Root cause

`!==` on a union that includes objects; the type predates API v2's `DeliverMax`.

## Proposed fix

Non-breaking:

```diff
--- a/packages/xrpl/src/sugar/autofill.ts
-    if (tx.Amount != null && tx.Amount !== tx.DeliverMax) {
+    if (tx.Amount != null && !amountsEqual(tx.Amount, tx.DeliverMax)) {
```

reusing `amountsEqual` from `client/partialPayment.ts` (move it to `models/utils`). For the type,
either `Amount?: …` with a validator rule "one of Amount/DeliverMax required", or a union
`Payment = PaymentWithAmount | PaymentWithDeliverMax`.

## Workaround today

Pass the same object reference, or omit `DeliverMax` and use `Amount`.

## References

- xrpl.org "Payment" (API v2 `DeliverMax`)
- `packages/xrpl/src/client/partialPayment.ts:31-63` (`amountsEqual`)
- Related: [030](030-simulate-does-not-thread-transaction-type.md)
