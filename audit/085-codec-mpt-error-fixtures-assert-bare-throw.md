# The binary codec's MPT amount error fixtures are label-only (`toThrow()` with no reason) and stop at 2^64−1, so the range bug in 022 sat next to a test named "Value is too large"

Severity: paper-cut
Category: test-infra

## Affected surface

- `amountErrorTests` — `packages/ripple-binary-codec/test/amount.test.ts:7-24`
  (`expect(() => { Amount.from(f.test_json); JSON.stringify(f.test_json) }).toThrow()` — the
  fixture's `error` string is used only in the test name)
- `packages/ripple-binary-codec/test/fixtures/data-driven-tests.json:2919-2933` — MPT vectors
  `"9223372036854775808"` (2^63) and `"18446744073709551615"` (2^64−1), both labelled
  `"Value is too large"`, both with bit 63 set
- `binary-parser.test.ts:217-219` skips all `error` entries

## Repro

Both fixture values are caught by the bit-63 check in `src/types/amount.ts:325`
(`BigInt(amount) & mptMask`), so the suite is green; `2^64 + 5` — bit 63 clear — is not in the
fixture and encodes as `5` ([022](022-binary-codec-silently-truncates-mpt-values-above-2-64.md)).
Because the assertion is a bare `toThrow()`, a future regression that throws for the *wrong* reason
(or a `TypeError` from a refactor) would also pass.

## Expected vs actual

Expected: `toThrow(/too large/)` (or the fixture's `error` text), plus vectors on the far side of
the range (`2^64`, `2^64 + 5`, `2^65`) and the non-canonical strings of
[023](023-binary-codec-accepts-non-canonical-mpt-value-strings.md).

Actual: the test that names the rule cannot detect its violation.

## Root cause

Generic data-driven runner written for "does it throw", not "why".

## Proposed fix

Test-only:

```ts
expect(() => Amount.from(f.test_json)).toThrow(new RegExp(f.error.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
```

and add the vectors above to `data-driven-tests.json` alongside the [022](022-binary-codec-silently-truncates-mpt-values-above-2-64.md)
fix.

## Workaround today

None needed for users.

## References

- Related: [022](022-binary-codec-silently-truncates-mpt-values-above-2-64.md), [023](023-binary-codec-accepts-non-canonical-mpt-value-strings.md)
