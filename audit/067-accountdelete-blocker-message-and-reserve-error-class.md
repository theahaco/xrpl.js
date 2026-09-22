# `checkAccountDeleteBlockers` names the wrong blockers for an MPT issuer/holder, and the owner-reserve fetch throws a plain `Error`

Severity: paper-cut
Category: runtime

## Affected surface

- `checkAccountDeleteBlockers` — `packages/xrpl/src/sugar/autofill.ts:542-547`
  (`throw new XrplError(\`Account ${tx.Account} cannot be deleted; there are Escrows, PayChannels, RippleStates, Checks, or Sponsorships associated with the account.\`, objectsResponse.result.account_objects)`)
- `getTransactionFee` for `AccountDelete` — `autofill.ts:275-277`
  (`Promise.reject(new Error('Could not fetch Owner Reserve.'))`)

## Repro

Offline with a stubbed `account_objects` (`deletion_blockers_only: true`) returning an
`MPTokenIssuance` and an `MPToken` (`audit/README.md` round-2 log):

```
XrplError: Account r… cannot be deleted; there are Escrows, PayChannels, RippleStates, Checks, or Sponsorships associated with the account.
  data: [{ LedgerEntryType: 'MPTokenIssuance' … }, { LedgerEntryType: 'MPToken' … }]
```

rippled's deletion-blocker set includes `MPTokenIssuance` and `MPToken` (an issuer must destroy its
issuances and a holder must opt out first); the message lists none of them.

## Expected vs actual

Expected: "cannot be deleted; blocked by: MPTokenIssuance (1), MPToken (1)" — the
`LedgerEntryType`s are in the response the function already holds. And the reserve error should be
an `XrplError` (it is the only plain `Error` in `autofill`).

Actual: a misleading list; an issuer winding down a token is told to look for escrows and checks.

## Root cause

Message hard-coded before MPT/NFT/DID blockers existed.

## Proposed fix

Non-breaking:

```ts
const kinds = [...new Set(objects.map((o) => o.LedgerEntryType))].join(', ')
throw new XrplError(`Account ${tx.Account} cannot be deleted; it still owns: ${kinds}.`, objects)
…
throw new XrplError('Could not fetch Owner Reserve (server_info.validated_ledger.reserve_inc_xrp missing).')
```

## Workaround today

Inspect `err.data` (typed `unknown`, [035](035-rippled-error-data-untyped.md)).

## References

- xrpl.org "Deletion of Accounts" (blocker object types)
- Related: [035](035-rippled-error-data-untyped.md)
