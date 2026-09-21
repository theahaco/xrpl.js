# Typed `fetchMPToken` / `fetchMPTokenIssuance` helpers already ship from `xrpl`, but live in the confidential module, are undocumented, take the concrete `Client`, and are themselves built on the `as unknown as` cast

Severity: minor
Category: missing-helper

## Affected surface

- `fetchMPToken`, `fetchMPTokenIssuance` — `packages/xrpl/src/confidential/ledger.ts:128-141, 154-166`
  (re-exported via `src/confidential/index.ts:19-25` → `src/index.ts` `export * from './confidential'`;
  `typeof require('xrpl').fetchMPToken === 'function'`)
- Not mentioned in `packages/xrpl/README.md` or `HISTORY.md` (5.x entry says only "Confidential
  Transfers"); no `@category` tag, so typedoc files them under nothing
- Their bodies: `return response.result.node as unknown as MPToken` (`ledger.ts:140`, `:165`)
- Parameter type `client: Client` (concrete class) — the repo's own unit tests stub it with
  `{ request, getLedgerIndex } as unknown as Client` (`test/confidential/helpers.ts:51-75`)

## Repro

The core MPT integration tests re-implement these reads with casts
(`clawback.test.ts:165-178` `@ts-expect-error`, `mptokenIssuanceSet.test.ts:465-483`
`readMPTokenIssuance`, `singleAssetVault.test.ts:155-159`), and so did this audit
(`audit/mpt-issuer/src/inspect.ts:62-99`) — none of us found the helpers, because nothing points
at them: search the README for "MPToken" and there is no hit; the doc comment on `fetchMPTokenIssuance`
describes it as the object "which carries the registered issuer and (optional) auditor encryption
keys", i.e. a confidential-transfer concern.

## Expected vs actual

Expected: the SDK's answer to "read a holder's MPToken / an issuance" is one documented helper
(next to `getBalances` in the client docs, `@category Utilities`), typed truthfully (`MPTAmount?`,
[010](010-mptoken-ledger-type-mismatches-rippled-json.md)), returning `undefined` on `entryNotFound`
rather than throwing a `RippledError` with `unknown` data ([035](035-rippled-error-data-untyped.md)),
and accepting a structural client (`Pick<Client, 'request' | 'getLedgerIndex'>`) so issuer code
can be unit-tested without a double cast.

Actual: the helper exists two imports away, invisibly; it inherits every gap of the typed
`ledger_entry` path ([005](005-ledger-entry-response-never-narrows-node.md),
[006](006-mptoken-missing-from-ledgerentry-union.md)) and papers over them with the same cast users
write.

## Root cause

Added for XLS-96 tooling; never promoted or documented as general MPT sugar.

## Proposed fix

Non-breaking: re-export from `utils` (or as `Client.getMPToken`/`getMPTokenIssuance` sugar) with
docs and `@category Utilities`; widen the parameter to a structural type; add an
`{ orUndefined: true }` variant; keep the confidential re-export as an alias.

## Workaround today

`import { fetchMPToken, fetchMPTokenIssuance } from 'xrpl'` — they work today.

## References

- Related: [005](005-ledger-entry-response-never-narrows-node.md), [006](006-mptoken-missing-from-ledgerentry-union.md), [010](010-mptoken-ledger-type-mismatches-rippled-json.md), [012](012-no-helper-to-derive-mpt-issuance-id-or-keylets.md), [035](035-rippled-error-data-untyped.md)
