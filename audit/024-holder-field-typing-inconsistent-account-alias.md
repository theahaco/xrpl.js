# `Clawback.Holder` is `string` while `MPTokenIssuanceSet.Holder` / `MPTokenAuthorize.Holder` are `Account`, and `Account` is a bare alias for `string`

Severity: paper-cut
Category: types

## Affected surface

- `Clawback.Holder?: string`, `Clawback.Account: string` — `packages/xrpl/src/models/transactions/clawback.ts:25,36`
  (redeclares `Account` from the base as `string`)
- `MPTokenIssuanceSet.Holder?: Account` — `MPTokenIssuanceSet.ts:139`;
  `MPTokenAuthorize.Holder?: Account` — `MPTokenAuthorize.ts:53`
- `export type Account = string` — `packages/xrpl/src/models/transactions/common.ts:360`

## Repro

```ts
import { Account } from 'xrpl'
const a: Account = 'not an address'   // compiles
```

The issuer project passes `holder: string` everywhere (`audit/mpt-issuer/src/ban.ts`, `freeze.ts`,
`holders.ts`) because the alias adds nothing; the address checks happen in `validate()`
(`isAccount` at `common.ts:377-382`) at sign time.

## Expected vs actual

Expected: one type for "an address" used consistently across the MPT transactions, and ideally a
branded type (`string & { readonly __brand: 'Account' }`) produced by `Wallet.classicAddress`,
`isValidClassicAddress` narrowing, and the decode helpers, so that a `MPTokenIssuanceID` cannot be
passed where an address goes.

Actual: `Clawback` uses raw `string` for both `Holder` and (redundantly) `Account`; the `Account`
alias exists but is structurally `string`, so the editor hover is the only place it helps. In an
API where every MPT call takes an address *and* a 48-hex ID *and* a decimal-string value, all typed
`string`, argument-order mistakes compile.

## Root cause

Aliases were introduced after `clawback.ts` was written; no branding.

## Proposed fix

Non-breaking first step: use `Account` on `Clawback.Holder` and drop the `Account` redeclaration.
Optional second step (breaking for callers that build addresses as plain strings): brand
`Account` and add `asAccount(s: string): Account` that validates.

```diff
--- a/packages/xrpl/src/models/transactions/clawback.ts
-  Account: string
+  // (inherited from BaseTransaction)
-  Holder?: string
+  Holder?: Account
```

## Workaround today

None needed; cosmetic.

## References

- Related: [036](036-mptokenissuanceid-format-not-validated.md) (the same "everything is string" problem for IDs)
