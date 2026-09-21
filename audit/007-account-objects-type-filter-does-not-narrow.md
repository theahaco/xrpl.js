# `account_objects` with a `type` filter still returns the full `AccountObject` union

Severity: minor
Category: rpc

## Affected surface

- `AccountObjectsRequest.type?: AccountObjectType` — `packages/xrpl/src/models/methods/accountObjects.ts:26`
- `AccountObjectsResponse.result.account_objects: AccountObject[]` — `accountObjects.ts:72`
- `RequestResponseMap` — `packages/xrpl/src/models/methods/index.ts:342-343` (one mapping for every
  `AccountObjectsRequest`)

## Repro

```ts
const res = await client.request({ command: 'account_objects', account, type: 'mpt_issuance' })
res.result.account_objects[0]?.MaximumAmount
// TS2339: Property 'MaximumAmount' does not exist on type 'AccountObject'.
```

Hit at `audit/mpt-issuer/src/inspect.ts:113-137` (`listHolderTokens`, `listIssuances`); compiled
repro `repros.ts` (`audit007`). The repo's own tests carry the same cast:
`packages/xrpl/test/integration/transactions/mptokenIssuanceCreate.test.ts:87,94`
(`// @ts-expect-error: Known issue with unknown object type`),
`payment.test.ts:195` (`// @ts-expect-error -- Object type not known`), and
`mptokenIssuanceSet.test.ts:463-471` (`.find((node) => (node as { mpt_issuance_id?: string })…) as MPTokenIssuance | undefined`).

## Expected vs actual

Expected: `type: 'mpt_issuance'` yields `MPTokenIssuance[]`; `type: 'mptoken'` yields `MPToken[]`
(rippled guarantees the filter). The filter name and the entry type are a fixed one-to-one mapping
already spelled out in `LedgerEntryFilter`.

Actual: the array is the full union regardless of `type`, and for `'mptoken'` the union does not even
contain the right member ([006](006-mptoken-missing-from-ledgerentry-union.md)).

## Root cause

`RequestResponseMap` maps by request *type*, and there is one request type for all filters.

## Proposed fix

Non-breaking, type-only. A filter-to-entry map plus a generic response:

```ts
// accountObjects.ts
export interface AccountObjectByFilter {
  mpt_issuance: MPTokenIssuance
  mptoken: MPToken
  state: RippleState
  offer: Offer
  // … one line per AccountObjectType
}
export interface AccountObjectsResponse<T extends AccountObject = AccountObject> extends BaseResponse {
  result: { …; account_objects: T[]; … }
}
export type AccountObjectsTypedRequest<K extends keyof AccountObjectByFilter> = AccountObjectsRequest & { type: K }
```

```ts
// methods/index.ts, ahead of the generic AccountObjectsRequest line
: T extends AccountObjectsTypedRequest<infer K> ? AccountObjectsResponse<AccountObjectByFilter[K]>
: T extends AccountObjectsRequest ? AccountObjectsResponse
```

`requestAll` should get the same treatment (`index.ts:516-517`).

## Workaround today

```ts
const issuances = res.result.account_objects.filter(
  (o): o is LedgerEntry.MPTokenIssuance => o.LedgerEntryType === 'MPTokenIssuance')
// and for mptoken, an unchecked cast:
const tokens = res.result.account_objects as unknown as LedgerEntry.MPToken[]
```

## References

- xrpl.org `account_objects` reference, `type` parameter table
- Related: [005](005-ledger-entry-response-never-narrows-node.md), [006](006-mptoken-missing-from-ledgerentry-union.md)
