# The codec's `UInt32.from(string)` is an unchecked `parseInt` and `UInt64.from(number | bigint)` truncates at 2^64 / loses precision above 2^53; both are reachable through `encode` and `client.submit(preSignedObject)` without `validate()`

Severity: minor
Category: runtime

## Affected surface

- `UInt32.from` — `packages/ripple-binary-codec/src/types/uint-32.ts:34-38` (`parseInt` without
  radix or range check); `writeUInt32BE` masks silently
- `UInt64.from` — `packages/ripple-binary-codec/src/types/uint-64.ts:57-69` (number),
  `:88-94` (bigint): `Number(val >> 32n)` into `writeUInt32BE`, the same pattern as
  [022](022-binary-codec-silently-truncates-mpt-values-above-2-64.md)
- Entry points that skip `validate()`: `encode` / `encodeForSigning` / `encodeForMultisigning`
  (public), and `submitRequest` — `packages/xrpl/src/sugar/submit.ts:57-60` (`encode(signedTransaction)`
  for an already-signed object, e.g. one handed back by a custody service)

## Repro

Offline (`audit/README.md` round-3 log):

```
encode/decode Create { ImmutableFlags: "4294967296" }   -> 0
encode/decode Create { Sequence: "-1" }                 -> 4294967295
encode/decode Create { MaximumAmount: 1e20 }            -> 7766279631452241920
encode/decode Create { MaximumAmount: 2**53+1 }         -> 9007199254740992
```

`validate()` rejects all of these (`isNumber` / `isString` guards), so `Wallet.sign` is safe; the
exposure is direct codec use and the pre-signed `submit` path.

## Expected vs actual

Expected: the string and number paths are as strict as the number path for `UInt32`
(`Invalid UInt32`) and a range error for `UInt64` inputs above 2^64−1 (and, for `number`, above
`Number.MAX_SAFE_INTEGER`).

Actual: silent wrap/truncation. The `xrpl` types (`MaximumAmount: string`, `Flags: number`) keep
most users away from these branches, which is why this is minor rather than a sibling of 022.

## Root cause

Lenient parsing helpers written before MPT introduced large decimal UInt64 fields.

## Proposed fix

Non-breaking in the codec:

```ts
// uint-32.ts
if (typeof val === 'string') { if (!/^[0-9]+$/.test(val)) throw …; const n = Number(val); if (n > 0xffffffff) throw … }
// uint-64.ts
if (typeof val === 'number' && (!Number.isSafeInteger(val) || val < 0)) throw new Error(`${fieldName}: number out of safe range; pass a string`)
if (typeof val === 'bigint' && (val < 0n || val > 0xffffffffffffffffn)) throw …
```

## Workaround today

Always go through `validate()` (i.e. `Wallet.sign`) and pass UInt64 fields as canonical decimal
strings.

## References

- Related: [022](022-binary-codec-silently-truncates-mpt-values-above-2-64.md), [039](039-assetscale-range-not-validated.md), [097](097-codec-error-messages-wrong-class-and-unwrapped.md)
