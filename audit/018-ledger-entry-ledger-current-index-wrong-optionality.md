# `ledger_entry` result declares `ledger_current_index: number` as required, but validated lookups return `ledger_index` + `ledger_hash` instead

Severity: minor
Category: rpc

## Affected surface

- `LedgerEntryResponseResultBase` — `packages/xrpl/src/models/methods/ledgerEntry.ts:255-265`
  (`index: string; ledger_current_index: number; validated?: boolean; deleted_ledger_index?: number`)

## Repro

`audit/mpt-issuer/src/inspect.ts:160-167` prints the keys of a `ledger_entry` + `mpt_issuance`
result requested with `ledger_index: 'validated'` (rippled 3.4.0-rc1):

```
ledger_entry result keys (validated lookup): index, ledger_hash, ledger_index, node, validated | ledger_current_index = undefined
```

```ts
const res = await client.request({ command: 'ledger_entry', mpt_issuance: id, ledger_index: 'validated' })
const n: number = res.result.ledger_current_index   // compiles; n === undefined at runtime
const h = res.result.ledger_hash                     // TS2339: does not exist on type
```

Compiled repro `repros.ts` (`audit005`, last line).

## Expected vs actual

Expected: the same shape rippled uses everywhere else and that the SDK already models on
`AccountObjectsResponse` (`accountObjects.ts:77-87`): `ledger_current_index?: number` for
current-ledger lookups, `ledger_index?: number` + `ledger_hash?: string` for closed/validated
lookups, `validated?: boolean`.

Actual: `ledger_current_index` is required and always `undefined` for the common `'validated'`
case, while `ledger_index`/`ledger_hash` are missing from the type. `LookupByLedgerRequest`
(`baseMethod.ts:19-24`) lets the caller pick either mode, so the response cannot be right for both.

## Root cause

Result type written from the current-ledger example only.

## Proposed fix

Type-only; loosening a required field is non-breaking for readers, and adding fields is additive.

```diff
 interface LedgerEntryResponseResultBase {
   index: string
-  ledger_current_index: number
+  /** Present when the lookup used the current (open) ledger. */
+  ledger_current_index?: number
+  /** Present when the lookup used a closed or validated ledger. */
+  ledger_index?: number
+  ledger_hash?: string
   validated?: boolean
   deleted_ledger_index?: number
 }
```

A discriminated version keyed on the request's `ledger_index` is possible but not worth the
complexity.

## Workaround today

`(res.result as { ledger_index?: number; ledger_hash?: string }).ledger_index`.

## References

- xrpl.org `ledger_entry` response fields
- `packages/xrpl/src/models/methods/accountObjects.ts:77-87` (correct pattern in the same package)
- Related: [005](005-ledger-entry-response-never-narrows-node.md)
