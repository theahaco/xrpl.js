# `MPToken` ledger type omits the `Account` field rippled always returns and marks `MPTAmount` required although rippled omits it when zero

Severity: major
Category: types

## Affected surface

- `MPToken` — `packages/xrpl/src/models/ledger/MPToken.ts:3-28`
  (`MPTokenIssuanceID: string; MPTAmount: string; Flags: number; OwnerNode?: string; LockedAmount?: string; …`)

## Repro

Raw entry returned by `ledger_entry` + `mptoken` for a holder that has only opted in
(`audit/mpt-issuer` holders run, verbatim):

```json
{
  "Account": "rJSAsZm9mrs7kdAxfswswBimT8DKgwWWwT",
  "Flags": 0,
  "LedgerEntryType": "MPToken",
  "MPTokenIssuanceID": "0000000CB3120458230058B528D813A6FAAE0C01743E7453",
  "OwnerNode": "0",
  "PreviousTxnID": "FF8964708994E4868056B4E40B2651D972FE8235F1EBDB3BC8E5B4921887876C",
  "PreviousTxnLgrSeq": 22,
  "index": "3E0EF1A38D33CECF97A8510C45CE6027632A00FFCEEC3A33DE4D5DC737332F20"
}
```

- `Account` is present; the type has no such field (`repros.ts` `audit010`:
  `token.Account` is TS2339).
- `MPTAmount` is absent; the type says `MPTAmount: string`. Any code doing
  `token.MPTAmount.length`, `BigInt(token.MPTAmount)` or `new BigNumber(token.MPTAmount)` crashes on a
  freshly opted-in holder or one that has been fully clawed back (`clawback.ts` output "alice
  MPToken entry after over-clawback" shows the same shape after the balance returned to 0).

The issuer project papers over it at `audit/mpt-issuer/src/inspect.ts:108-111`
(`token?.MPTAmount ?? '0'` — unreachable per the types) and `scenario.ts` asserts both facts
("MPToken JSON carries Account", "fresh MPToken omits MPTAmount").

## Expected vs actual

Expected: the type matches rippled's `ltMPTOKEN` template: `Account: string` (required),
`MPTAmount?: string` (default-valued, omitted when 0), `LockedAmount?: string`,
`OwnerNode: string` (required), `Flags: number`, plus the `index` from `BaseLedgerEntry`.

Actual: `Account` missing, `MPTAmount` wrongly required, `OwnerNode` wrongly optional. Because the
type is also unreachable by narrowing ([006](006-mptoken-missing-from-ledgerentry-union.md)) the
mismatch has gone unnoticed; the repo's own tests only ever read `MPTAmount` on funded holders.

## Root cause

The interface was written from the spec's field list rather than from rippled's object template,
which marks `MPTAmount` `soeDEFAULT` (omitted when zero) and `Account` `soeREQUIRED`.

## Proposed fix

Type-only; making `MPTAmount` optional is technically breaking for callers that already assume it
is present (they were already wrong at runtime).

```diff
--- a/packages/xrpl/src/models/ledger/MPToken.ts
+++ b/packages/xrpl/src/models/ledger/MPToken.ts
 export interface MPToken extends BaseLedgerEntry, HasPreviousTxnID {
   LedgerEntryType: 'MPToken'
+  /** The holder's address. */
+  Account: string
   MPTokenIssuanceID: string
-  MPTAmount: string
+  /** Holder balance in fractional units. Omitted by rippled when zero. */
+  MPTAmount?: string
   Flags: number
-  OwnerNode?: string
+  OwnerNode: string
   LockedAmount?: string
```

Pair it with a helper `getMPTokenBalance(token): string` (returns `'0'` when absent) and a unit test
built from the JSON above.

## Workaround today

```ts
const balance = (token as unknown as { MPTAmount?: string }).MPTAmount ?? '0'
const holder = (token as unknown as { Account: string }).Account
```

## References

- rippled `LedgerFormats.cpp`, `ltMPTOKEN`: `{sfAccount, soeREQUIRED}, {sfMPTokenIssuanceID, soeREQUIRED}, {sfMPTAmount, soeDEFAULT}, {sfLockedAmount, soeOPTIONAL}, {sfOwnerNode, soeREQUIRED}, …`
- Verified on rippled 3.4.0-rc1 (holders/ban/clawback runs in `audit/mpt-issuer`)
- Related: [006](006-mptoken-missing-from-ledgerentry-union.md), [009](009-mptoken-flags-no-enum-or-parser.md), [011](011-mptokenissuance-type-lacks-mpt-issuance-id.md)
