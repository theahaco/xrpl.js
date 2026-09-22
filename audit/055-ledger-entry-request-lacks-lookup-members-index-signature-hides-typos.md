# `LedgerEntryRequest` has no `permissioned_domain` / `vault` / `oracle` / `nft_offer` / `loan` lookups, and `BaseRequest`'s index signature lets any misspelled request key compile

Severity: minor
Category: rpc

## Affected surface

- `LedgerEntryRequest` — `packages/xrpl/src/models/methods/ledgerEntry.ts:22-245` (lookup members
  stop at `sponsorship`; nothing for `permissioned_domain`, `vault`, `oracle`, `nft_offer`, `loan`,
  `loan_broker`)
- `BaseRequest` — `packages/xrpl/src/models/methods/baseMethod.ts:5-6` (`[x: string]: unknown`)

## Repro

All of these compile (`tsc --strict`, `audit/README.md` round-2 log):

```ts
client.request({ command: 'ledger_entry', permissioned_domain: domainId })            // not a typed lookup; passes via index signature
client.request({ command: 'ledger_entry', mpt_issuance: issuanceId, ledger_indx: 'validated' })   // typo: reads the CURRENT ledger
client.request({ command: 'account_objects', account, typ: 'mptoken' })               // typo: returns ALL objects
```

rippled ignores unknown keys, so the second returns an unvalidated read and the third the full
object list — both silently wrong for "is this holder locked on the validated ledger?".

## Expected vs actual

Expected: the lookups the compliance flow needs (`permissioned_domain` for the domain the issuance
points at; `credential` fixed per [054](054-ledger-entry-credential-lookup-typed-with-wrong-key.md))
are typed, and a misspelled key is a compile error like it is on every other TypeScript API.

Actual: the request-side twin of [004](004-basetransaction-record-string-unknown-collapses-keyof.md):
the index signature on `BaseRequest` disables excess-property checking for every request literal,
which is also why the missing lookups have gone unnoticed (they "work" — untyped).

## Root cause

Forward-compatibility escape hatch placed on the base interface.

## Proposed fix

- Add the missing lookup members (non-breaking).
- Move the escape hatch off `BaseRequest` (breaking only for code that relied on sending unknown
  keys through the typed API; provide `client.request` overload for `BaseRequest & Record<string, unknown>`
  or reuse [026](026-admin-commands-not-in-request-union.md)'s fallback overload).

## Workaround today

Double-check key spellings by hand; use `satisfies LedgerEntryRequest` (does not help — same index
signature).

## References

- xrpl.org `ledger_entry` (lists `permissioned_domain`, `vault`, `oracle`, `nft_offer`)
- Related: [004](004-basetransaction-record-string-unknown-collapses-keyof.md), [026](026-admin-commands-not-in-request-union.md), [054](054-ledger-entry-credential-lookup-typed-with-wrong-key.md)
