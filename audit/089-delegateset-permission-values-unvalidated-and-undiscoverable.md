# `validateDelegateSet` accepts any string as `PermissionValue`; the MPT granular permissions (`MPTokenIssuanceLock`/`Unlock`) exist only inside the codec, with no enum, union, doc or test in `xrpl`

Severity: minor
Category: validation

## Affected surface

- `validateDelegateSet` — `packages/xrpl/src/models/transactions/delegateSet.ts:97-104`
  (`typeof === 'string'` plus a `NON_DELEGABLE_TRANSACTIONS` deny-list at `:12-23`)
- `Permission.PermissionValue: string` — `delegateSet.ts:25-29`
- Authoritative name table: `packages/ripple-binary-codec/src/enums/xrpl-definitions-base.ts:107-108`
  (`MPTokenIssuanceLock: 65547`, `MPTokenIssuanceUnlock: 65548`);
  `grep -rn MPTokenIssuanceLock packages/xrpl/src packages/xrpl/README.md packages/xrpl/HISTORY.md` → nothing;
  `test/models/delegateSet.test.ts` lists ten granular names and omits both MPT ones

## Repro

Offline (`audit/README.md` round-3 log):

```
validate(DelegateSet MPTokenIssuanceLock)   -> ok   encode: ok
validate(DelegateSet MPTokenIssuanceset)    -> ok   encode: TypeError: Unable to interpret "PermissionValue: MPTokenIssuanceset".
validate(DelegateSet MPTokenIssuanceLok)    -> ok   encode: TypeError: Unable to interpret "PermissionValue: MPTokenIssuanceLok".
typeof require('xrpl').GranularPermission   -> undefined
```

`PermissionValue: 'MPTokenIssuanceLok'` compiles (`string`).

## Expected vs actual

Expected: a compliance issuer delegating only freeze/unfreeze (never clawback) to an operations
key finds `MPTokenIssuanceLock` / `MPTokenIssuanceUnlock` as members of an exported
`GranularPermission` enum, `PermissionValue` is `TransactionType | GranularPermission`, and
`validate()` rejects unknown names with a `ValidationError`.

Actual: the names are undiscoverable from `xrpl` (only the codec's definitions know them), a typo
passes `validate()` and dies in the codec with a `TypeError`, and the deny-list approach will let
newly added transaction types through even if rippled's allow-list (`fixDelegateV1_1`) forbids
delegating them (unverified on-ledger).

## Root cause

Delegation model written with a free-form string; the codec's permission table was never surfaced.

## Proposed fix

Non-breaking:

```ts
export enum GranularPermission { TrustlineAuthorize = 'TrustlineAuthorize', …, MPTokenIssuanceLock = 'MPTokenIssuanceLock', MPTokenIssuanceUnlock = 'MPTokenIssuanceUnlock' }
export type PermissionValue = TransactionType | `${GranularPermission}`
// validator: membership check against DEFAULT_DEFINITIONS.delegatablePermissions (codec already exports the table)
```

## Workaround today

Copy the names from `xrpl-definitions-base.ts`.

## References

- XLS-75 (Permission Delegation) §Granular permissions
- Related: [037](037-mpt-validators-do-not-check-flag-masks.md), [074](074-permissioned-domain-and-credential-fields-shape-only.md)
