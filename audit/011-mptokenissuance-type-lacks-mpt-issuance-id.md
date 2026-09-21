# `MPTokenIssuance` ledger type lacks the synthetic `mpt_issuance_id` rippled injects into every JSON view of the entry

Severity: minor
Category: rpc

## Affected surface

- `MPTokenIssuance` — `packages/xrpl/src/models/ledger/MPTokenIssuance.ts:3-101`

## Repro

`ledger_entry` + `mpt_issuance` on rippled 3.4.0-rc1 (issue run, verbatim tail of the entry):

```json
{
  "LedgerEntryType": "MPTokenIssuance",
  "Sequence": 7,
  "index": "910ED7E8D1ECC5687209DB58B66CC76E282398BDACA4F5E3C263531E90B775CC",
  "mpt_issuance_id": "000000077EEF664B7A629066730123E42508AA854744FFE7"
}
```

```ts
const issuance: LedgerEntry.MPTokenIssuance = …
issuance.mpt_issuance_id
// TS2339: Property 'mpt_issuance_id' does not exist on type 'MPTokenIssuance'.
```

Compiled repro `repros.ts` (`audit011`). The issuer project declares
`type MPTokenIssuanceOnLedger = MPTokenIssuance & { mpt_issuance_id?: string }`
(`audit/mpt-issuer/src/inspect.ts:54`) to read it; the repo's own test does the same inline:
`packages/xrpl/test/integration/transactions/mptokenIssuanceSet.test.ts:466`
`(node as { mpt_issuance_id?: string }).mpt_issuance_id === issuanceId`.

## Expected vs actual

Expected: the field is on the type, because it is the only place an `account_objects` /
`ledger_data` consumer can get the ID needed for every subsequent transaction (`MPTokenIssuanceID`,
`Amount.mpt_issuance_id`) without re-deriving it from `Issuer` + `Sequence`.

Actual: the type stops at the on-ledger fields; the RPC-layer addition (rippled adds it in
`RPC::injectMPTokenIssuanceID`-style post-processing for `ledger_entry`, `account_objects`,
`ledger_data`, and `tx` metadata `CreatedNode`s) is invisible, so the typical "find my issuance in
account_objects" loop needs a cast.

## Root cause

Same class of omission as `AccountRoot`-style synthetic fields elsewhere: the ledger type was
transcribed from the object template, not from the JSON rippled serialises.

## Proposed fix

Non-breaking addition:

```diff
--- a/packages/xrpl/src/models/ledger/MPTokenIssuance.ts
+++ b/packages/xrpl/src/models/ledger/MPTokenIssuance.ts
   Sponsor?: string
+  /**
+   * The 192-bit MPTokenIssuanceID (Sequence ‖ Issuer AccountID) for this issuance.
+   * Not stored on the ledger; rippled adds it to every JSON view of the entry.
+   */
+  mpt_issuance_id: string
 }
```

If the maintainers prefer to keep ledger types "pure", export a `deriveMPTokenIssuanceID` helper
instead ([012](012-no-helper-to-derive-mpt-issuance-id-or-keylets.md)) and document the injected
field.

## Workaround today

```ts
const id = (issuance as unknown as { mpt_issuance_id?: string }).mpt_issuance_id
```

## References

- xrpl.org `MPTokenIssuance` object reference (documents `mpt_issuance_id` as returned by the API)
- Related: [007](007-account-objects-type-filter-does-not-narrow.md), [012](012-no-helper-to-derive-mpt-issuance-id-or-keylets.md)
