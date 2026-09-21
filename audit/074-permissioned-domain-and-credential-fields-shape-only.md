# Permissioned-domain and credential validators are shape-only: a zero `DomainID` on `PermissionedDomainSet`, case-variant duplicate credentials, non-address `Issuer`/`Subject` and malformed `CredentialIDs` all pass `validate()`

Severity: minor
Category: validation

## Affected surface

- `validatePermissionedDomainSet` — `packages/xrpl/src/models/transactions/permissionedDomainSet.ts:39`
  (`DomainID` via `isString`); `validatePermissionedDomainDelete` — `permissionedDomainDelete.ts:27`
- `isAuthorizeCredential` — `common.ts:317-327` (`typeof === 'string'` for `CredentialType`/`Issuer`)
- `validateCredentialsList` — `common.ts:1129-1135`; `containsDuplicates` — `common.ts:1164-1187`
  (string comparison)
- `validateCredentialCreate` (`CredentialCreate.ts:52`, `Subject` via `isString`),
  `validateCredentialAccept` (`CredentialAccept.ts:41`), `validateCredentialDelete` (`CredentialDelete.ts:52-54`)
- Doc/validator conflict: `permissionedDomainSet.ts:22-25` says "An empty array means deleting the
  field" while the validator throws `Credentials cannot be an empty array`

## Repro

Live via `simulate` (rippled 3.4.0-rc1, `audit/README.md` round-2 log); both pass `validate()`:

```
PDSet DomainID = zero hash                                          -> temMALFORMED
PDSet duplicate credentials (CredentialType 'AB' and 'ab')          -> temMALFORMED
```

Offline, all `validate() -> ok`: `PermissionedDomainSet { DomainID: 'abc' }`; credential with
`Issuer: 'nope'`, `CredentialType: 'zz'`, `''`, 65 bytes; `Payment { CredentialIDs: ['zz'] }`
(codec then: `Invalid Hash length 1`); `CredentialCreate { Subject: 'nope' }`;
`CredentialAccept { Issuer: 'nope' }`.

## Expected vs actual

Expected: `DomainID` uses `isDomainID` (as MPT and Payment do); `Issuer`/`Subject` use `isAccount`;
`CredentialType` is 1–64 bytes of even-length hex; `CredentialIDs` are 64-hex hashes; duplicate
detection compares decoded bytes (case-insensitive hex, X-address vs classic). These are the fields
of the permissioned-domain admission route ([028](028-pre-emptive-ban-not-expressible-on-ledger.md),
option 3).

Actual: pass-through to rippled (`temMALFORMED`) or to the codec.

## Root cause

XLS-70/80 validators written with `isString` throughout.

## Proposed fix

Non-breaking: swap the guards (`isDomainID`, `isAccount`, `isHexWithByteLength(1..64)`, a 64-hex
guard for IDs), normalise before `containsDuplicates` (`toUpperCase()` on hex, `areAddressesEqual`
on issuers), and fix the `AcceptedCredentials` doc to "must contain 1–10 entries; to delete the
domain use `PermissionedDomainDelete`".

## Workaround today

Application-level checks.

## References

- rippled `credentials::checkArray` (`temMALFORMED` on empty/oversized types and duplicates); `PermissionedDomainSet::preflight`
- Related: [036](036-mptokenissuanceid-format-not-validated.md), [038](038-isdomainid-rejects-zero-hash-that-clears-domain.md), [054](054-ledger-entry-credential-lookup-typed-with-wrong-key.md)
