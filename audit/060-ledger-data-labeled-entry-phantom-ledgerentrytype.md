# `LedgerDataLabeledLedgerEntry` requires a lowercase `ledgerEntryType` field that rippled never emits

Severity: paper-cut
Category: rpc

## Affected surface

- `LedgerDataLabeledLedgerEntry` — `packages/xrpl/src/models/methods/ledgerData.ts:46-48`
  (`{ ledgerEntryType: string } & LedgerEntry`)

## Repro

The repo's own fixture `packages/xrpl/test/fixtures/rippled/ledgerDataFirstPage.json`: every state
entry has `LedgerEntryType` (capitalised, from the object) and `index`; no `ledgerEntryType`.
`grep -rn ledgerEntryType packages/xrpl/src packages/xrpl/test` matches only the type definition.

```ts
const entry = res.result.state[0]
if (!('data' in entry)) {
  const label: string = entry.ledgerEntryType   // compiles; undefined at runtime
}
```

Anyone using `'ledgerEntryType' in entry` as the JSON-vs-binary discriminator gets `false` for every
entry.

## Expected vs actual

Expected: the JSON arm is just `LedgerEntry` (which already carries `LedgerEntryType` as the
discriminant), and the binary arm `{ data: string; index: string }`.

Actual: a phantom required field. Relevant to MPT only in that `ledger_data` with
`type: 'mptoken'` is the one way (besides Clio) to enumerate holders across the whole ledger
([015](015-mpt-holders-request-untyped.md)), and its typing is wrong twice over
([006](006-mptoken-missing-from-ledgerentry-union.md) + this).

## Root cause

Likely a confusion with the request's `type` filter parameter.

## Proposed fix

```diff
-export type LedgerDataLabeledLedgerEntry = { ledgerEntryType: string } & LedgerEntry
+export type LedgerDataLabeledLedgerEntry = LedgerEntry
```

(breaking only for code that read the non-existent field).

## Workaround today

Discriminate on `'LedgerEntryType' in entry`.

## References

- Related: [006](006-mptoken-missing-from-ledgerentry-union.md), [015](015-mpt-holders-request-untyped.md)
