# `ripple-binary-codec` silently truncates MPT `value` strings ≥ 2^64 to their low 64 bits (2^64 + 5 encodes as 5)

Severity: blocker
Category: runtime

## Affected surface

- `Amount.assertMptIsValid` — `packages/ripple-binary-codec/src/types/amount.ts:309-327`
- `Amount.from` MPT branch — `amount.ts:153-168` (`writeUInt32BE(intBuf[0], Number(num >> 32n))`)
- Reached by every MPT transaction the SDK signs: `Wallet.sign` → `encode` (`Payment`, `Clawback`,
  `EscrowCreate`, `VaultDeposit`, … any field carrying an `MPTAmount`)

## Repro

```js
const { encode, decode } = require('ripple-binary-codec')
const tx = { TransactionType: 'Clawback', Account: 'rHb9…', Holder: 'rrrr…', Fee: '10', Sequence: 1,
             SigningPubKey: '', Amount: { mpt_issuance_id: '00000001' + '0'.repeat(40), value: V } }
decode(encode(tx)).Amount.value
```

| `V`                                    | result                       |
| -------------------------------------- | ---------------------------- |
| `"18446744073709551621"` (2^64 + 5)    | `"5"` — no error             |
| `"18446744073709551616"` (2^64)        | `"0"` — no error             |
| `"36893488147419103232"` (2^65)        | `"0"` — no error             |
| `"9223372036854775808"` (2^63)         | throws "is an illegal amount" (correct) |
| `"18446744073709551615"` (2^64 − 1)    | throws "is an illegal amount" (correct) |

Run in this audit (`node -e`, see `audit/README.md` "Round 1 log"); observed end-to-end in
`audit/mpt-issuer/src/clawback.ts` output (`value above uint64 ("18446744073709551616") → engine
temBAD_AMOUNT`, i.e. rippled received a zero amount, not an error from the SDK).

## Expected vs actual

Expected: any value outside `0 ≤ v ≤ 2^63 − 1` is rejected before serialisation with a clear error,
as the 2^63 and 2^64 − 1 cases are.

Actual: the range check is `BigInt(amount) & 0x8000000000000000n !== 0` — it tests **bit 63
only**. Values with bit 63 clear and higher bits set pass, and the two `writeUInt32BE` calls then
serialise `Number(num >> 32n)` (which is ≥ 2^32 and silently wraps in the isomorphic writer) and the
low 32 bits. The transaction that reaches the network carries a different amount than the caller
specified. For `Payment`, 2^64 + 5 units becomes a valid 5-unit payment that will succeed; for
`Clawback` likewise. No layer in `xrpl` catches it ([016](016-mpt-amount-value-not-validated-no-scale-helper.md)).

## Root cause

`assertMptIsValid` checks the sign bit instead of the magnitude; `Amount.from` trusts it.

## Proposed fix

Non-breaking (rejects only values that were already wrong on the wire):

```diff
--- a/packages/ripple-binary-codec/src/types/amount.ts
+++ b/packages/ripple-binary-codec/src/types/amount.ts
@@ private static assertMptIsValid(amount: string): void {
-    if (!decimal.isZero()) {
-      if (decimal < BigNumber(0)) {
-        throw new Error(`${amount.toString()} is an illegal amount`)
-      }
-
-      if (Number(BigInt(amount) & BigInt(mptMask)) != 0) {
-        throw new Error(`${amount.toString()} is an illegal amount`)
-      }
-    }
+    if (!/^(0|[1-9][0-9]*)$/.test(amount)) {
+      throw new Error(`${amount} is an illegal amount`)
+    }
+    if (BigInt(amount) > BigInt('9223372036854775807')) {
+      throw new Error(`${amount} is an illegal amount`)
+    }
```

The regex also closes [023](023-binary-codec-accepts-non-canonical-mpt-value-strings.md). Add a
unit test with the table above to `packages/ripple-binary-codec/test/amount.test.ts`.

## Workaround today

Validate `value` in application code before signing (regex + `BigInt(value) <= 2n**63n - 1n`).

## References

- XLS-33 §MPTAmount: 63-bit unsigned integer
- `packages/ripple-binary-codec/src/types/amount.ts:20` (`mptMask = 0x8000000000000000n`)
- Related: [016](016-mpt-amount-value-not-validated-no-scale-helper.md), [023](023-binary-codec-accepts-non-canonical-mpt-value-strings.md)
