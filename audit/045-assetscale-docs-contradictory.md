# `AssetScale` is documented with two mutually inverted formulas, and neither says which fields are in fractional units

Severity: minor
Category: docs

## Affected surface

- `MPTokenIssuanceCreate.AssetScale` doc — `packages/xrpl/src/models/transactions/MPTokenIssuanceCreate.ts:220-226`
- `MPTokenIssuance.AssetScale` doc — `packages/xrpl/src/models/ledger/MPTokenIssuance.ts:23-28`
- `MPTAmount.value`, `MaximumAmount`, `OutstandingAmount` docs (no unit statement) — `models/common/index.ts:27-30`, `MPTokenIssuanceCreate.ts:228-238`, `MPTokenIssuance.ts:36-43`

## Repro

Create side (verbatim):

> the asset scale is a non-negative integer (0, 1, 2, …) such that one standard unit equals
> 10^(-scale) of a corresponding fractional unit.

Ledger side (verbatim):

> such that one MPT unit equals 10^(-scale) of a corresponding standard unit.

With `AssetScale: 2` (the issuer project's setting, `audit/mpt-issuer/src/issue.ts:31`), the ledger
stores `value: '1234'` for 12.34 tokens: one *fractional* (on-ledger) unit is 10^(-2) standard units
— the ledger-side sentence. The create-side sentence is inverted (it is XLS-33's own wording copied
verbatim).

## Expected vs actual

Expected: one definition, stated where the developer sets the field and repeated where they read
it, plus the consequence: every on-ledger amount (`MPTAmount.value`, `Payment.Amount.value`,
`Clawback.Amount.value`, `MaximumAmount`, `OutstandingAmount`) is an integer count of fractional
units.

Actual: the two docs disagree, and none of the amount fields say "fractional units", so the first
`Payment` an integrator writes is off by 10^scale (the issuer project documents the convention
itself at `holders.ts:56-66`).

## Root cause

Spec wording copied uncritically; no unit statement on the amount fields.

## Proposed fix

Docs only, both sites:

```ts
/**
 * Number of decimal places for display. On-ledger amounts (`MPTAmount.value`, `MaximumAmount`,
 * `OutstandingAmount`) are integers in fractional units; one standard unit = 10^AssetScale
 * fractional units (scale 2: `value: '1234'` is 12.34). Defaults to 0. Immutable after creation.
 */
```

and on `MPTAmount.value`: "Integer string, in fractional units of the issuance's `AssetScale`."
A conversion helper is [016](016-mpt-amount-value-not-validated-no-scale-helper.md).

## Workaround today

Trust the ledger-side sentence.

## References

- XLS-33 §AssetScale
- Related: [016](016-mpt-amount-value-not-validated-no-scale-helper.md), [039](039-assetscale-range-not-validated.md)
