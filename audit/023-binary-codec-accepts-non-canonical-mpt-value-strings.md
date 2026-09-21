# `ripple-binary-codec` accepts `"0x10"`, `"+7"`, `" 9"` as MPT values (JavaScript `BigInt` semantics) and throws a raw `SyntaxError` for `"1e2"`

Severity: minor
Category: validation

## Affected surface

- `Amount.assertMptIsValid` — `packages/ripple-binary-codec/src/types/amount.ts:309-327`
- `Amount.from` MPT branch — `amount.ts:153-168` (`const num = BigInt(value.value)`)

## Repro

```js
decode(encode({ …, Amount: { mpt_issuance_id, value: V } })).Amount.value
```

| `V`      | result                                              |
| -------- | --------------------------------------------------- |
| `"0x10"` | `"16"`                                              |
| `"+7"`   | `"7"`                                               |
| `" 9"`   | `"9"`                                               |
| `"1e2"`  | throws `SyntaxError: Cannot convert 1e2 to a BigInt` |

End-to-end in `audit/mpt-issuer/src/clawback.ts`: `value hex-looking ("0x10") → tesSUCCESS` clawed
16 units from a holder with 9 (clamped), `value exponent ("1e2") → SyntaxError` surfaced through
`submitAndWait` with no `ValidationError` wrapper.

## Expected vs actual

Expected: the codec accepts exactly the canonical decimal form rippled emits (`/^(0|[1-9][0-9]*)$/`)
and rejects everything else with the codec's own `Error("… is an illegal amount")`, as it does for
`"1.5"`, `"-1"` and `""`.

Actual: the check is `indexOf('.') === -1`, then `new BigNumber(amount)` (which accepts `0x`, `+`,
whitespace and exponents), then `BigInt(amount)` (which accepts `0x`/`0o`/`0b`, `+`, whitespace, but
not exponents). Inputs a UI or CSV import might produce are silently reinterpreted; `"0x10"` is
worth sixteen times what a reader of the transaction JSON would assume.

Round-3 note (sweep g): the codec's own fixtures
(`packages/ripple-binary-codec/test/fixtures/data-driven-tests.json:2952-3017`) expect errors for
`"0xy"`, `"/"` and for *hex values out of range*, which implies in-range `0x…` MPT values were
intended to be accepted. Whoever fixes this should decide deliberately (rippled's JSON parser does
not accept `0x` for MPT values as far as this audit could tell; not verified live) and reconcile
the fixtures with [085](085-codec-mpt-error-fixtures-assert-bare-throw.md).

## Root cause

Two lenient parsers with different grammars used as a validator.

## Proposed fix

Same one-line regex as in [022](022-binary-codec-silently-truncates-mpt-values-above-2-64.md);
add the four rows above to the codec's unit tests.

## Workaround today

Canonicalise in application code before building the transaction.

## References

- MDN `BigInt()` string grammar (accepts hex/octal/binary prefixes and surrounding whitespace)
- Related: [016](016-mpt-amount-value-not-validated-no-scale-helper.md), [022](022-binary-codec-silently-truncates-mpt-values-above-2-64.md)
