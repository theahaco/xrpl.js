# `AssetScale` is validated only as "a number"; out-of-range values (`300`, `-1`) fail at the RPC/codec layer instead of `validate()`

Severity: minor
Category: validation

## Affected surface

- `validateMPTokenIssuanceCreate` — `packages/xrpl/src/models/transactions/MPTokenIssuanceCreate.ts:289`
  (`validateOptionalField(tx, 'AssetScale', isNumber)`)
- `MPTokenIssuanceCreate.AssetScale?: number` doc — `MPTokenIssuanceCreate.ts:219-226` ("a
  non-negative integer (0, 1, 2, …)", no upper bound)

## Repro

`npm run probes`:

```
Create: AssetScale 300 | validate: ok | rippled: RippledError: Field 'tx_json.AssetScale' is out of range.
Create: AssetScale -1  | validate: ok | rippled: RippledError: Field 'tx_json.AssetScale' is out of range.
```

Through `submitAndWait` the same values fail inside the binary codec (`UInt8`) during
`Wallet.sign`, with a codec `Error`, after `validate()` passed. `1.5` passes `isNumber` too.

## Expected vs actual

Expected: `AssetScale` is an integer in `0..255` (`sfAssetScale` is `UInt8`); `validate()` says so
with a `ValidationError`, and the doc comment states the bound (XLS-89 metadata tooling caps display
precision on it, so wildly wrong values are a real mistake class).

Actual: any JS number passes; the failure is an RPC or codec error with no field-level message.

## Root cause

Generic `isNumber` guard.

## Proposed fix

Non-breaking:

```ts
const MAX_ASSET_SCALE = 255
if (typeof tx.AssetScale === 'number' && (!Number.isInteger(tx.AssetScale) || tx.AssetScale < 0 || tx.AssetScale > MAX_ASSET_SCALE)) {
  throw new ValidationError(`MPTokenIssuanceCreate: AssetScale must be an integer between 0 and ${MAX_ASSET_SCALE}`)
}
```

The same `isUInt8`/`isUInt16`/`isUInt32` guards would serve `TransferFee` (already bounded),
`DestinationTag`, `TickSize`, etc.

Round-2 extension (sweep b): `AssetScale: 2.5`, `AssetScale: NaN`, `TransferFee: 12.5`,
`TransferFee: NaN` and `CredentialCreate.Expiration: -1` / `1.5` all pass `validate()` (`isNumber`
accepts any JS number) and fail in the codec with `Cannot construct UInt8/UInt16/UInt32 from given
value`. `Number.isInteger` belongs in the same guard.

## Workaround today

Bound-check in application code.

## References

- rippled `SField` definitions (`sfAssetScale`, UInt8); XLS-33 §AssetScale
- Related: [016](016-mpt-amount-value-not-validated-no-scale-helper.md)
