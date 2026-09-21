# MPT validators call `console.warn` from inside `validate()`/`sign()` for non-XLS-89 metadata, with no way to capture or silence it

Severity: paper-cut
Category: validation

## Affected surface

- `validateMPTokenIssuanceCreate` — `packages/xrpl/src/models/transactions/MPTokenIssuanceCreate.ts:378-391`
  (`console.warn(message)` when `validateMPTokenMetadata` returns messages)
- `validateMPTokenIssuanceSet` — `MPTokenIssuanceSet.ts:326-337` (same)
- Reached from `Wallet.sign` (`Wallet/index.ts:409`) on every `submit`/`submitAndWait`

## Repro

```ts
const tx: MPTokenIssuanceCreate = { …, MPTokenMetadata: stringToHex('{"n":"x"}') }
await client.submitAndWait(tx, { wallet })
// stderr: MPTokenMetadata is not properly formatted as JSON as per the XLS-89 standard. …
//         - ticker/t: should have uppercase letters (A-Z) and digits (0-9) only. Max 6 characters recommended.
//         - icon/i: should be a non-empty string.
//         …
```

The same warning fires from a validator that is otherwise pure and from `validate()` when used as
a form-level check, once per call.

## Expected vs actual

Expected: a library validator either throws, returns diagnostics, or exposes a hook; it does not
write to the process's console. `validateMPTokenMetadata(hex): string[]` already exists and
returns the messages — that is the right API; the `console.warn` in the transaction validators is
the sharp edge.

Actual: any service that signs MPT issuance transactions with non-conforming metadata (deliberately
or during migration) gets untagged multi-line stderr output on every sign; there is no option, event,
or logger to redirect it, and unit tests of the validator have to stub `console`.

## Root cause

XLS-89 conformance is advisory ("not mandatory"), so the authors chose a warning over an error and
picked `console.warn` as the channel.

## Proposed fix

Non-breaking: remove the `console.warn` from the two validators and expose the advisory check
explicitly.

```ts
// MPTokenIssuanceCreate.ts / MPTokenIssuanceSet.ts: delete the console.warn blocks
// models/utils/mptokenMetadata.ts: keep validateMPTokenMetadata(); document it as the advisory check
// Client: optional `warnings` event or `ClientOptions.onWarning?(w: { code, message })`, already used by handlePartialPayment
```

`handlePartialPayment` (`client/partialPayment.ts`) already attaches structured `warnings` to
responses; reusing that shape keeps one warning channel.

## Workaround today

Call `validateMPTokenMetadata(hex)` yourself before building the transaction and pass
metadata that yields `[]`, or stub `console.warn`.

## References

- XLS-89 (metadata schema is a recommendation)
- Related: [008](008-mptokenissuanceset-docs-incomplete.md)
