# `MPToken` is missing from the `LedgerEntry` union, so no holder-side entry can ever be narrowed without a cast

Severity: major
Category: types

## Affected surface

- `LedgerEntry` union — `packages/xrpl/src/models/ledger/LedgerEntry.ts:29-56` (includes
  `MPTokenIssuance` at line 56, never `MPToken`)
- `LedgerEntryFilter` — `LedgerEntry.ts:58-88` (does list `'mptoken'` at line 75)
- `MPToken` — `packages/xrpl/src/models/ledger/MPToken.ts:3-28` (exported from `ledger/index.ts:82`
  but never joined to the union)
- Everything typed on the union: `LedgerEntryJsonResponse.node`, `AccountObject`
  (`accountObjects.ts:54-57`), `ledger_data` entries

## Repro

```ts
const res = await client.request({
  command: 'ledger_entry',
  mptoken: { mpt_issuance_id: issuanceId, account: holder },
})
if (res.result.node.LedgerEntryType === 'MPToken') { /* … */ }
// TS2367: This comparison appears to be unintentional because the types
//   '"AccountRoot" | "Amendments" | … | "MPTokenIssuance"' and '"MPToken"' have no overlap.
```

Hit at `audit/mpt-issuer/src/inspect.ts:80-99` (`getMPToken` needs `as unknown as MPToken`) and
`inspect.ts:113-125` (`listHolderTokens`). Compiled repro `repros.ts` (`audit006`) asserts
`Extract<LedgerEntry, { LedgerEntryType: 'MPToken' }>` is `never`.

The repo's own test acknowledges it:
`packages/xrpl/test/integration/transactions/clawback.test.ts:175` and `:201`
`// @ts-expect-error: Known issue with unknown object type` on `ledgerEntryResponse.result.node.MPTAmount`.

## Expected vs actual

Expected: `ledger_entry` + `mptoken`, `account_objects` + `type: 'mptoken'`, and `ledger_data`
can all yield an `MPToken`, and the discriminated union lets `LedgerEntryType === 'MPToken'` narrow
to it.

Actual: the SDK models the holder entry (`MPToken.ts`) and the filter name (`'mptoken'`) but never
adds the type to the union, so it is unreachable by narrowing. Reading `lsfMPTLocked` /
`lsfMPTAuthorized` / the balance of a holder — the core read path for a compliance token — always
requires `as unknown as MPToken`. `DID`, `NFTokenPage` and `NFTokenOffer` are missing from the union
in the same way.

## Root cause

Omission in `LedgerEntry.ts`; the union is hand-maintained and MPToken was added to the ledger
folder without being added to the union.

## Proposed fix

Non-breaking (widening a union that callers already have to discriminate on):

```diff
--- a/packages/xrpl/src/models/ledger/LedgerEntry.ts
+++ b/packages/xrpl/src/models/ledger/LedgerEntry.ts
@@
 import LoanBroker from './LoanBroker'
+import { MPToken } from './MPToken'
 import { MPTokenIssuance } from './MPTokenIssuance'
@@
   | XChainOwnedCreateAccountClaimID
   | MPTokenIssuance
+  | MPToken
+  | DID
+  | NFTokenPage
+  | NFTokenOffer
```

Add a unit test that every `LedgerEntryFilter` has a union member with the matching
`LedgerEntryType` (a small `Record<LedgerEntryFilter, LedgerEntry['LedgerEntryType']>` would fail to
compile when one is missing). Fix [010](010-mptoken-ledger-type-mismatches-rippled-json.md) in the
same change so the newly-reachable type is right.

## Workaround today

```ts
const token = res.result.node as unknown as LedgerEntry.MPToken
```

## References

- rippled `LedgerFormats.cpp` (`ltMPTOKEN` object template: Account, MPTokenIssuanceID, MPTAmount, LockedAmount, Flags, OwnerNode, PreviousTxnID, PreviousTxnLgrSeq)
- Related: [005](005-ledger-entry-response-never-narrows-node.md), [007](007-account-objects-type-filter-does-not-narrow.md), [009](009-mptoken-flags-no-enum-or-parser.md), [010](010-mptoken-ledger-type-mismatches-rippled-json.md)
