# `Client.getBalances` silently omits every MPT holding, and its return type cannot represent one

Severity: major
Category: runtime

## Affected surface

- `Client.getBalances` — `packages/xrpl/src/client/index.ts:1007-1052` (return type `:1016`:
  `Array<{ value: string; currency: string; issuer?: string }>`; sources: `account_info.Balance` and
  `requestAll({ command: 'account_lines' })` only)
- `formatBalances` — `packages/xrpl/src/sugar/balances.ts:9-15`
- `Balance` — `packages/xrpl/src/models/common/index.ts:37-41`

## Repro

Live (rippled 3.4.0-rc1, `audit/README.md` round-2 log): a holder onboarded with 100 units of the
audit token:

```
getBalances(holder) = [{"currency":"XRP","value":"999.99976"}]
account_objects(mptoken) count = 1
```

## Expected vs actual

Expected: the method documented as "Get XRP/non-XRP balances for an account" returns a row per MPT
(`{ mpt_issuance_id, value }`, ideally scaled by `AssetScale`), sourced from `account_objects`
`type: 'mptoken'` (paginated via `requestAll`).

Actual: MPTs are not trust lines, so they never appear; a compliance sweep or dashboard built on the
one convenience method named "balances" sees zero MPT exposure for every holder. Same class of
silent omission as [053](053-getbalancechanges-ignores-mpt-nodes.md).

## Root cause

`getBalances` predates MPT; the `Balance` type has no MPT arm
([017](017-amount-type-excludes-mptamount.md)).

## Proposed fix

Non-breaking (additive rows and an optional field, or a new method if the shape must stay):

```ts
export interface Balance { currency: string; issuer?: string; value: string; mpt_issuance_id?: string }

// getBalances: alongside the account_lines pages
const mptPages = await this.requestAll({ command: 'account_objects', account, type: 'mptoken', ledger_index, ledger_hash })
const mptBalances = mptPages.flatMap((p) => p.result.account_objects)
  .filter((o): o is LedgerEntry.MPToken => o.LedgerEntryType === 'MPToken')          // needs 006
  .map((t) => ({ currency: 'MPT', mpt_issuance_id: t.MPTokenIssuanceID, value: t.MPTAmount ?? '0' }))  // needs 010
```

Document that `value` is in fractional units unless the caller resolves `AssetScale`.

## Workaround today

`audit/mpt-issuer/src/inspect.ts` `listHolderTokens` + `holderBalance`.

## References

- Related: [053](053-getbalancechanges-ignores-mpt-nodes.md), [006](006-mptoken-missing-from-ledgerentry-union.md), [010](010-mptoken-ledger-type-mismatches-rippled-json.md), [016](016-mpt-amount-value-not-validated-no-scale-helper.md)
