# Ledger-entry types are only reachable as `LedgerEntry.MPToken` etc.; `import { MPToken } from 'xrpl'` fails with a misleading suggestion and the repo's own tests deep-import instead

Severity: paper-cut
Category: docs

## Affected surface

- `export * as LedgerEntry from './ledger'` — `packages/xrpl/src/models/index.ts:1-9`
- `parseMPTokenIssuanceFlags` / `parseMPTokenIssuanceImmutableFlags` exported at top level —
  `models/index.ts:10-17`, while their input/output types (`MPTokenIssuanceFlagsInterface`) are
  under the namespace
- Repo tests: `packages/xrpl/test/integration/transactions/mptokenIssuanceSet.test.ts:15-19`
  (`import type { MPTokenIssuance, MPTokenIssuanceFlagsInterface } from '../../../src/models/ledger/MPTokenIssuance'`),
  `mptokenIssuanceCreate.test.ts:14`

## Repro

```ts
import { MPToken, MPTokenIssuance, MPTokenIssuanceFlagsInterface } from 'xrpl'
// TS2305: Module '"xrpl"' has no exported member 'MPToken'.
// TS2724: '"xrpl"' has no exported member named 'MPTokenIssuance'. Did you mean 'MPTokenIssuanceSet'?
// TS2724: '"xrpl"' has no exported member named 'MPTokenIssuanceFlagsInterface'. Did you mean 'MPTokenIssuanceSetFlagsInterface'?
```

Compiled repro `repros.ts` (top of file). `audit/mpt-issuer/src/inspect.ts:6-17` aliases the
namespace members locally after hitting this.

## Expected vs actual

Expected: either the entry types are top-level (`MPToken`, `MPTokenIssuance` do not collide with
any transaction name; the namespace exists to avoid `DepositPreauth` ledger-vs-transaction
ambiguity), or the namespace is documented where a developer will look (package README, the
`Client.request` docs for `ledger_entry`/`account_objects`), and the compiler's "did you mean"
does not point at an unrelated transaction type.

Actual: the design note lives in a comment in `models/index.ts`. The maintainers' own tests bypass
the namespace with relative deep imports, which is the strongest signal it is not discoverable. The
flag parser and the flag interface it returns live on different sides of the boundary.

## Root cause

A namespace chosen for one collision applied to all 30+ ledger types.

## Proposed fix

Non-breaking: re-export the non-colliding ledger types at top level, keeping the namespace.

```ts
// models/index.ts
export * as LedgerEntry from './ledger'
export type {
  MPToken, MPTokenIssuance, MPTokenIssuanceFlagsInterface, MPTokenIssuanceImmutableFlagsInterface,
  AccountRoot, RippleState, Offer, /* … every name that does not collide with a transaction */
} from './ledger'
export { MPTokenIssuanceFlags, MPTokenIssuanceImmutableFlags } from './ledger'
```

and one paragraph in the package README.

## Workaround today

`import { LedgerEntry } from 'xrpl'; type MPToken = LedgerEntry.MPToken`.

## References

- `packages/xrpl/src/models/index.ts:1-9` (the design note)
- Related: [006](006-mptoken-missing-from-ledgerentry-union.md), [009](009-mptoken-flags-no-enum-or-parser.md)
