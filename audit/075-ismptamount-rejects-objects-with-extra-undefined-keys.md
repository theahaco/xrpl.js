# `isMPTAmount` / `isIssuedCurrencyAmount` require an exact own-key count, so an amount object carrying an extra `undefined` key is rejected although it serialises identically

Severity: paper-cut
Category: validation

## Affected surface

- `isMPTAmount` — `packages/xrpl/src/models/transactions/common.ts:335-342`
  (`Object.keys(input).length === MPT_CURRENCY_AMOUNT_SIZE`)
- `isIssuedCurrencyAmount` — `common.ts:299-310` (same pattern)
- `Wallet.sign` strips nullish keys at the top level only — `Wallet/index.ts:392-395`

## Repro

Offline (`audit/README.md` round-2 log):

```ts
validate({ …Payment, Amount: { mpt_issuance_id, value, currency: undefined } })
// ValidationError: PaymentTransaction: invalid Amount
validate({ …Clawback, Amount: { mpt_issuance_id, value, issuer: undefined } })
// ValidationError: Clawback: invalid field Amount
```

`JSON.stringify` of both is the canonical two-key form; rippled would accept the serialised
transaction. The shape arises naturally from spreading a generic `{ currency?, issuer?, value,
mpt_issuance_id? }` record (e.g. a form model or a row from `getBalances`) into an amount.

## Expected vs actual

Expected: a structural check (`mpt_issuance_id` and `value` are strings; no *defined* foreign
keys), matching what the codec accepts (`isAmountObjectMPT` in `ripple-binary-codec` also counts
keys — `amount.ts:65-71` — so the two must be changed together).

Actual: key counting rejects harmless `undefined` members and accepts a two-key object with the
wrong keys renamed by a class getter. Minor, but the error message ("invalid Amount") gives no hint
that an extra key is the cause.

## Root cause

Shape check by cardinality.

## Proposed fix

Non-breaking:

```ts
export function isMPTAmount(input: unknown): input is MPTAmount {
  if (!isRecord(input)) return false
  const defined = Object.keys(input).filter((k) => input[k] !== undefined)
  return defined.length === 2 && isMPTokenIssuanceID(input.mpt_issuance_id) && isMPTValue(input.value)
}
```

(and the same in the codec's `isAmountObjectMPT`).

## Workaround today

Build amounts as fresh literals: `{ mpt_issuance_id, value }`.

## References

- Related: [016](016-mpt-amount-value-not-validated-no-scale-helper.md), [017](017-amount-type-excludes-mptamount.md)
