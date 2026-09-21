# `MPTAmount.value` is never validated by `validate()`, malformed values fail in three different layers, and there is no `AssetScale`-aware conversion helper

Severity: major
Category: validation

## Affected surface

- `MPTAmount` — `packages/xrpl/src/models/common/index.ts:27-30` (`value: string`)
- `isMPTAmount` — `packages/xrpl/src/models/transactions/common.ts:335-342` (checks two keys and
  `typeof value === 'string'` only)
- `validateClawback` — `clawback.ts:45-69`; `validatePayment` — `payment.ts:200-240` (both accept any
  string)
- `utils/index.ts` — has `xrpToDrops`/`dropsToXrp`, nothing for MPT units
- Binary codec `Amount.assertMptIsValid` — `packages/ripple-binary-codec/src/types/amount.ts:309-327`

## Repro

`audit/mpt-issuer/src/clawback.ts` (`npm run clawback`), Clawback of `{ mpt_issuance_id, value }`
with each value, rippled 3.4.0-rc1, verbatim:

```
value zero ("0"):                validate() ok | submit: engine temBAD_AMOUNT
value negative ("-1"):           validate() ok | submit: codec  "-1 is an illegal amount"
value decimal ("1.5"):           validate() ok | submit: codec  "1.5 is an illegal amount"
value exponent ("1e2"):          validate() ok | submit: error  SyntaxError: Cannot convert 1e2 to a BigInt
value leading plus ("+1"):       validate() ok | submit: engine tesSUCCESS   (clawed 1)
value hex-looking ("0x10"):      validate() ok | submit: engine tesSUCCESS   (clawed 16!)
value empty (""):                validate() ok | submit: codec  " is an illegal amount"
value whitespace (" 1"):         validate() ok | submit: engine tecINSUFFICIENT_FUNDS (parsed as 1)
value max int64:                 validate() ok | submit: engine tecINSUFFICIENT_FUNDS
value max int64 + 1:             validate() ok | submit: codec  "…808 is an illegal amount"
value above uint64 (2^64):       validate() ok | submit: engine temBAD_AMOUNT (serialised as 0, see 022)
```

`npm run probes` adds `Payment: MPT value "0" | validate: ok | rippled: temBAD_AMOUNT`.

## Expected vs actual

Expected: `validate()` rejects anything that is not a canonical non-negative decimal integer string
within `0 < v ≤ 2^63-1` with a `ValidationError` naming the field, and the SDK offers
`mptToUnits(value, assetScale)` / `unitsToMpt(units, assetScale)` (the MPT analogue of
`xrpToDrops`/`dropsToXrp`) so callers do not hand-scale `"12.34"` into `"1234"`.

Actual: `validate()` passes every string. Failures then come from three unrelated places with three
error types — rippled (`temBAD_AMOUNT`, a fee-charging round trip via `submit`), the codec
(`Error("… is an illegal amount")`), or a raw `SyntaxError` from `BigInt()` — and three inputs that
a human would consider malformed (`"+1"`, `" 1"`, `"0x10"`) are silently accepted with JavaScript
`BigInt` parsing semantics, so `"0x10"` moves sixteen units. The `AssetScale` on the issuance is
purely informational to the SDK; nothing helps convert a display amount to units.

## Root cause

`isMPTAmount` is a shape check; the codec's `assertMptIsValid` is the only value check and it was
written to reject `.`/negatives, not to canonicalise; conversions were never added.

## Proposed fix

Non-breaking (rejects only inputs rippled or the codec would already reject, plus the three
BigInt-lenient forms, which are almost certainly bugs at the call site):

```ts
// models/transactions/common.ts
const MPT_VALUE = /^(0|[1-9][0-9]*)$/u
const MAX_MPT_VALUE = 9223372036854775807n
export function isMPTValue(value: unknown): value is string {
  return typeof value === 'string' && MPT_VALUE.test(value) && BigInt(value) <= MAX_MPT_VALUE
}
export function isMPTAmount(input: unknown): input is MPTAmount {
  return isRecord(input) && Object.keys(input).length === 2 &&
    isMPTokenIssuanceID(input.mpt_issuance_id) && isMPTValue(input.value)
}
// validateClawback / validatePayment: additionally reject value === '0' (temBAD_AMOUNT)

// utils/mptConversion.ts
export function mptToUnits(amount: BigNumber.Value, assetScale = 0): string   // '12.34', 2 -> '1234'; throws on excess precision
export function unitsToMpt(units: string, assetScale = 0): string             // '1234', 2 -> '12.34'
```

Sequence the codec change in [022](022-binary-codec-silently-truncates-mpt-values-above-2-64.md)
first so that the two layers agree.

## Workaround today

Validate with the regex above in application code and scale by hand
(`audit/mpt-issuer/src/holders.ts:56-66` documents the unit convention instead).

## References

- XLS-33 §MPTAmount ("unsigned 63-bit integer"); rippled `STMPTAmount`
- Related: [022](022-binary-codec-silently-truncates-mpt-values-above-2-64.md), [023](023-binary-codec-accepts-non-canonical-mpt-value-strings.md), [017](017-amount-type-excludes-mptamount.md)
