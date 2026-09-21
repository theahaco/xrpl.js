# No way to obtain a `PermissionedDomain` or `Credential` ledger ID from the transaction that created it; the repo's tests take "the last `account_objects` entry"

Severity: minor
Category: missing-helper

## Affected surface

- `utils/hashes/index.ts` — `packages/xrpl/src/utils/hashes/index.ts:53-228` exports
  `hashAccountRoot`, `hashSignerListId`, `hashOfferId`, `hashTrustline`, `hashEscrow`,
  `hashPaymentChannel`, `hashVault`, `hashLoanBroker`, `hashLoan`; nothing for `PermissionedDomain`,
  `Credential` (nor `MPTokenIssuance`/`MPToken`, [012](012-no-helper-to-derive-mpt-issuance-id-or-keylets.md))
- `utils/hashes/ledgerSpaces.ts` — no `permissionedDomain` / `credential` namespace
- `MPTokenIssuanceCreate.DomainID` / `MPTokenIssuanceSet.DomainID` require exactly this ID

## Repro

The repo's own tests (`packages/xrpl/test/integration/transactions/mptokenIssuanceSet.test.ts:507-531`,
`permissionedDomain.test.ts:51-58`):

```ts
const accountObjects = await client.request({ command: 'account_objects', account, type: 'permissioned_domain' })
const newestDomain = accountObjects.result.account_objects[accountObjects.result.account_objects.length - 1] as PermissionedDomain
return newestDomain.index
```

`audit/mpt-issuer/src/domain.ts:47-60` does slightly better (finds the `CreatedNode` of type
`PermissionedDomain` in `meta.AffectedNodes` and takes `LedgerIndex`), which still means walking
untyped metadata. rippled injects no synthetic ID into `PermissionedDomainSet` metadata, and
`ledger_entry` cannot look a domain up by owner ([055](055-ledger-entry-request-lacks-lookup-members-index-signature-hides-typos.md)).

## Expected vs actual

Expected: `hashPermissionedDomain(owner, sequence)` and `hashCredential(subject, issuer,
credentialType)` next to `hashEscrow`, and/or a generic `getCreatedEntryIndex(meta,
'PermissionedDomain')`. The domain ID is the handle for the whole permissioned-domain admission
route ([028](028-pre-emptive-ban-not-expressible-on-ledger.md), option 3).

Actual: "last object in the account's list" — racy with any other domain the account creates —
or hand-rolled metadata walking.

## Root cause

Keylet helpers were added per feature and skipped for XLS-70/80.

## Proposed fix

Non-breaking additions in `utils/hashes/index.ts` (namespaces from rippled `LedgerNameSpace`:
`PERMISSIONED_DOMAIN = 'm'`, `CREDENTIAL = 'D'` — verify against `Indexes.cpp` when
implementing), plus:

```ts
export function getCreatedEntryIndex(meta: TransactionMetadata, type: LedgerEntry['LedgerEntryType']): string | undefined {
  for (const n of meta.AffectedNodes) if (isCreatedNode(n) && n.CreatedNode.LedgerEntryType === type) return n.CreatedNode.LedgerIndex
  return undefined
}
```

## Workaround today

`audit/mpt-issuer/src/domain.ts:47-60` (`createDomain`).

## References

- rippled `Indexes.cpp` (`keylet::permissionedDomain(account, seq)`, `keylet::credential(subject, issuer, type)`)
- Related: [012](012-no-helper-to-derive-mpt-issuance-id-or-keylets.md), [055](055-ledger-entry-request-lacks-lookup-members-index-signature-hides-typos.md)
