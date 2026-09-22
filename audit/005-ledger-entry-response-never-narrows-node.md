# `ledger_entry` responses never narrow `result.node` to the entry type the lookup field implies

Severity: major
Category: rpc

## Affected surface

- `LedgerEntryRequest` — `packages/xrpl/src/models/methods/ledgerEntry.ts:22-245` (every lookup
  field — `mpt_issuance`, `mptoken`, `account_root`, `offer`, … — optional on one flat interface)
- `LedgerEntryJsonResponse<T = LedgerEntry>` — `ledgerEntry.ts:284-292`
- `RequestResponseMap` — `packages/xrpl/src/models/methods/index.ts:430-435` (maps every
  `ledger_entry` request to `LedgerEntryJsonResponse` with the default `LedgerEntry` union)

## Repro

```ts
const res = await client.request({ command: 'ledger_entry', mpt_issuance: issuanceId })
res.result.node.MPTokenMetadata
// TS2339: Property 'MPTokenMetadata' does not exist on type 'LedgerEntry'.
//   Property 'MPTokenMetadata' does not exist on type 'AccountRoot'.
```

Hit at `audit/mpt-issuer/src/inspect.ts:62-76` (`getIssuance`), which adds a
`LedgerEntryType !== 'MPTokenIssuance'` throw purely to narrow; compiled repro
`audit/mpt-issuer/src/type-repros/repros.ts` (`audit005`). For `mptoken` lookups even that is
impossible, see [006](006-mptoken-missing-from-ledgerentry-union.md).

## Expected vs actual

Expected: `mpt_issuance: string` on the request implies `node: MPTokenIssuance`; `mptoken: {...}`
implies `node: MPToken`; `account_root` implies `AccountRoot`, and so on. The RPC contract makes the
type unambiguous.

Actual: `node` is always the 27-member `LedgerEntry` union. Every caller casts or discriminates on
`LedgerEntryType` before touching an entry-specific field. `node` itself is correctly non-optional
(the `binary` discrimination works), so this is purely the missing lookup-field discrimination.

## Root cause

No type ties a populated lookup field to a response type. `RequestResponseMap` only distinguishes
`binary: true` vs not.

## Proposed fix

Non-breaking, type-only. One intersection type per lookup field, threaded ahead of the generic
fallback (the same pattern `LedgerEntryBinaryRequest` already uses):

```ts
// ledgerEntry.ts
export type LedgerEntryMptIssuanceRequest = LedgerEntryJsonRequest & { mpt_issuance: string }
export type LedgerEntryMptokenRequest     = LedgerEntryJsonRequest & { mptoken: { mpt_issuance_id: string; account: string } | string }
export type LedgerEntryAccountRootRequest = LedgerEntryJsonRequest & { account_root: string }
// … one per lookup field
```

```ts
// methods/index.ts (inside RequestResponseMap, before the LedgerEntryJsonRequest line)
: T extends LedgerEntryBinaryRequest      ? LedgerEntryBinaryResponse
: T extends LedgerEntryMptIssuanceRequest ? LedgerEntryJsonResponse<MPTokenIssuance>
: T extends LedgerEntryMptokenRequest     ? LedgerEntryJsonResponse<MPToken>
: T extends LedgerEntryAccountRootRequest ? LedgerEntryJsonResponse<AccountRoot>
: …
: T extends LedgerEntryJsonRequest        ? LedgerEntryJsonResponse   // unchanged fallback
```

Requests that use `index` or mix fields keep today's behaviour. `MPToken` must first be added to the
union for the `mptoken` line to be useful ([006](006-mptoken-missing-from-ledgerentry-union.md)).

## Workaround today

```ts
const node = res.result.node
if (node.LedgerEntryType !== 'MPTokenIssuance') throw new Error('unexpected entry')
node.MPTokenMetadata // narrowed
```

or `res.result.node as LedgerEntry.MPTokenIssuance`.

## References

- Captain's seed document (`issues.md`, "`ledger_entry` responses don't narrow `node`")
- xrpl.org `ledger_entry` reference (each lookup field documents its single result type)
- Related: [006](006-mptoken-missing-from-ledgerentry-union.md), [007](007-account-objects-type-filter-does-not-narrow.md), [018](018-ledger-entry-ledger-current-index-wrong-optionality.md)
