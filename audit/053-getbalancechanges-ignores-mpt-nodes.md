# `getBalanceChanges` silently ignores `MPToken` / `MPTokenIssuance` nodes: an MPT payment or clawback reports only the XRP fee

Severity: major
Category: runtime

## Affected surface

- `getBalanceChanges` — `packages/xrpl/src/utils/getBalanceChanges.ts:161-185` (exported at
  `utils/index.ts`; `@category Utilities`)
- `Balance` — `packages/xrpl/src/models/common/index.ts:37-41` (`{ currency; issuer?; value }`, no MPT shape)

## Repro

```ts
// getBalanceChanges.ts:167-183
const quantities = normalizeNodes(metadata).map((node) => {
  if (node.LedgerEntryType === 'AccountRoot') { … }
  if (node.LedgerEntryType === 'RippleState') { … }
  return []          // MPToken and MPTokenIssuance nodes land here
})
```

Live (rippled 3.4.0-rc1, `audit/README.md` round-2 log): a validated MPT `Payment` of 10 units
holder→issuer and a `Clawback` of 5 units:

```
getBalanceChanges(MPT payment meta)  = [{"account":"r32a…","balances":[{"currency":"XRP","value":"-0.00024"}]}]
getBalanceChanges(MPT clawback meta) = [{"account":"r4wM…","balances":[{"currency":"XRP","value":"-0.00024"}]}]
```

The metadata contains `ModifiedNode`s of `LedgerEntryType: 'MPToken'` (`MPTAmount` 100→90, then
90→85) and of `MPTokenIssuance` (`OutstandingAmount`); none of it is reported.

## Expected vs actual

Expected: the holder's `−10`/`−5` and the issuer-side outstanding delta as balance rows keyed by
`mpt_issuance_id` — or, failing that, a documented throw "MPT metadata not supported".

Actual: a reconciliation/audit-log helper that reports "nothing moved" for a clawback. A compliance
issuer building a ledger of enforcement actions from transaction metadata (the natural design, since
`mpt_holders` is Clio-only, [015](015-mpt-holders-request-untyped.md)) gets silent zeros.

## Root cause

The helper predates MPT and its result type cannot represent an MPT balance.

## Proposed fix

Non-breaking (adds rows and an optional field):

```ts
export interface Balance { currency: string; issuer?: string; value: string; mpt_issuance_id?: string }

// getBalanceChanges.ts
if (node.LedgerEntryType === 'MPToken') {
  const account = node.FinalFields?.Account ?? node.NewFields?.Account   // (needs 010's Account field)
  const before = BigInt(node.PreviousFields?.MPTAmount ?? (node.NewFields ? 0 : node.FinalFields?.MPTAmount ?? 0))
  const after  = BigInt(node.FinalFields?.MPTAmount ?? node.NewFields?.MPTAmount ?? 0)   // DeletedNode → 0
  return [{ account, balance: { mpt_issuance_id: node.FinalFields.MPTokenIssuanceID, currency: 'MPT', value: (after - before).toString() } }]
}
if (node.LedgerEntryType === 'MPTokenIssuance') { /* issuer row from OutstandingAmount delta, negated */ }
```

with `currency: 'MPT'` (or a dedicated `MPTBalance` union member) so existing consumers keep
compiling. Add a unit test from the metadata above.

## Workaround today

Walk `meta.AffectedNodes` by hand for `LedgerEntryType === 'MPToken'` (remember `MPTAmount` is absent
when 0, [010](010-mptoken-ledger-type-mismatches-rippled-json.md)).

## References

- Related: [010](010-mptoken-ledger-type-mismatches-rippled-json.md), [017](017-amount-type-excludes-mptamount.md), [077](077-getbalances-omits-mpt-holdings.md)
