# `ImmutableFlags` accepts only a number although the SDK exports `MPTokenIssuanceCreateImmutableFlagsInterface` and every other flag field accepts the interface form

Severity: paper-cut
Category: types

## Affected surface

- `MPTokenIssuanceCreate.ImmutableFlags?: number` — `packages/xrpl/src/models/transactions/MPTokenIssuanceCreate.ts:266`
- `MPTokenIssuanceSet.ImmutableFlags?: number` — `MPTokenIssuanceSet.ts:175`
- `MPTokenIssuanceCreateImmutableFlagsInterface` — `MPTokenIssuanceCreate.ts:170-207` (exported,
  accepted nowhere)
- Contrast: `Flags?: number | MPTokenIssuanceCreateFlagsInterface` — `MPTokenIssuanceCreate.ts:257`;
  `convertTxFlagsToNumber` — `models/utils/flags.ts:174-205` (handles `Flags` only)

## Repro

```ts
const tx: MPTokenIssuanceCreate = {
  …,
  Flags: { tfMPTCanLock: true, tfMPTRequireAuth: true },          // ok
  ImmutableFlags: { tifMPTCanTrade: true, tifMPTCanEscrow: true }, // TS2322: not assignable to 'number'
}
```

`audit/mpt-issuer/src/issue.ts:44-60` builds the mask with `|` over the enum instead.

## Expected vs actual

Expected: `ImmutableFlags?: number | MPTokenIssuanceCreateImmutableFlagsInterface`, converted by
`autofill`/`validate` the same way `Flags` is, and `parseMPTokenIssuanceImmutableFlags` as the
inverse (that one exists).

Actual: the interface type exists (and is what `parseMPTokenIssuanceImmutableFlags` returns) but
the transaction fields do not accept it; there is no `convertImmutableFlagsToNumber`.

## Root cause

DynamicMPT fields were added with a numeric bitmask only.

## Proposed fix

Non-breaking:

```ts
ImmutableFlags?: number | MPTokenIssuanceCreateImmutableFlagsInterface
// models/utils/flags.ts
export function convertImmutableFlagsToNumber(flags: number | MPTokenIssuanceCreateImmutableFlagsInterface): number
// called from validateMPTokenIssuanceCreate/Set before the mask check, and from autofill
```

## Workaround today

`MPTokenIssuanceCreateImmutableFlags.tifMPTCanTrade | MPTokenIssuanceCreateImmutableFlags.tifMPTCanEscrow`.

## References

- Related: [008](008-mptokenissuanceset-docs-incomplete.md)
