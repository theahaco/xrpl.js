# Codec range errors say `Invalid Function: 256 must be >= 0 and <= 255`, `MaximumAmount` overflow says "is not a valid hex-string", and per-field failures surface as raw `TypeError`s with no field name

Severity: paper-cut
Category: runtime

## Affected surface

- `UInt.checkUintRange` — `packages/ripple-binary-codec/src/types/uint.ts:51-57`
  (`this.constructor.name` inside a *static* method is `"Function"`)
- `UInt64.from` — `packages/ripple-binary-codec/src/types/uint-64.ts:72-81` (base-10 → hex
  conversion happens before the 16-char check, so overflow reports the hex form)
- `STObject.from` — `packages/ripple-binary-codec/src/types/st-object.ts:146-161` (only an
  `undefined` result is wrapped; `associatedType.from` errors propagate bare)
- `Amount.assertMptIsValid` — `amount.ts:310` (`amount.indexOf` on a non-string)

## Repro

Offline (`audit/README.md` round-3 log):

```
sign(Create AssetScale 256)                        -> Error: Invalid Function: 256 must be >= 0 and <= 255
encode(Create MaximumAmount "18446744073709551616") -> Error: 10000000000000000 is not a valid hex-string
Amount.from({ mpt_issuance_id, value: 5 })          -> TypeError: amount.indexOf is not a function
encode(Set { MPTokenIssuanceID: null })             -> Error: Cannot construct Hash from given value
encode(Set { Holder: null })                        -> Error: Cannot construct AccountID from value given
```

## Expected vs actual

Expected: `Invalid UInt8 (AssetScale): 256 must be >= 0 and <= 255`,
`MaximumAmount 18446744073709551616 exceeds 2^64-1`, `Amount.value must be a decimal string
(field Amount)`. One `try/catch` in `STObject.from` that prefixes the field name would fix every
"generic codec error" complaint in [036](036-mptokenissuanceid-format-not-validated.md),
[039](039-assetscale-range-not-validated.md), [065](065-sign-accepts-interface-flags-then-fails-in-codec.md),
[066](066-account-validated-as-string-only.md).

Actual: the class name is wrong, the number is shown in a base the user never wrote, and the field
is unnamed — on a transaction with a dozen fields, each of which can be the culprit.

## Root cause

Static-method `this.constructor.name`; conversion-before-check; no wrapping layer.

## Proposed fix

Non-breaking, codec-only:

```ts
// uint.ts: use the concrete class name passed in, e.g. checkUintRange(val, min, max, name = 'UInt')
// uint-64.ts: validate the decimal range before converting to hex
// st-object.ts, inside the field loop:
try { … associatedType.from(value) … } catch (e) { throw new Error(`${field.name}: ${(e as Error).message}`, { cause: e }) }
```

## Workaround today

None needed; cosmetic.

## References

- Related: [036](036-mptokenissuanceid-format-not-validated.md), [039](039-assetscale-range-not-validated.md), [065](065-sign-accepts-interface-flags-then-fails-in-codec.md), [096](096-codec-lenient-uint-numeric-and-string-inputs.md)
