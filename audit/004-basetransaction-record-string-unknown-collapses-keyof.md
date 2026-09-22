# `BaseTransaction extends Record<string, unknown>` collapses `keyof` on every transaction type, so `Omit`/`Partial` silently no-op and field-name typos compile

Severity: major
Category: types

## Affected surface

- `BaseTransaction` — `packages/xrpl/src/models/transactions/common.ts:670` (`extends Record<string, unknown>`)
- Every transaction interface that extends it, including `MPTokenIssuanceCreate`
  (`MPTokenIssuanceCreate.ts:217`), `MPTokenIssuanceSet` (`MPTokenIssuanceSet.ts:129`),
  `MPTokenAuthorize` (`MPTokenAuthorize.ts:43`), `Clawback` (`clawback.ts:19`), `Payment`
  (`payment.ts:126`)

## Repro

All of the following compile under `strict: true` and none should:

```ts
type K = keyof MPTokenIssuanceSet                  // string | number
const k: keyof MPTokenIssuanceSet = 'not-a-field'  // ok
const o: Omit<MPTokenIssuanceSet, 'MPTokenIssuanceID'> = {}            // ok: Omit produced an index signature
const still: Omit<MPTokenIssuanceSet, 'Holder'> = { Holder: 'r...' }   // ok: the omitted key is still allowed

const typo: MPTokenIssuanceSet = {
  TransactionType: 'MPTokenIssuanceSet',
  Account: 'r...',
  MPTokenIssuanceID: '00',
  Hodler: 'r...',            // ok: excess-property check is defeated by the index signature
}
```

Compiled repro: `audit/mpt-issuer/src/type-repros/repros.ts` (`audit004`), which uses
`Expect<Equal<keyof MPTokenIssuanceSet, string | number>>` so that the file stops compiling when this
is fixed. In the issuer project every builder in `holders.ts`, `freeze.ts`, `ban.ts` is one typo away
from a silently-ignored field (rippled would then reject with `temMALFORMED`/`temINVALID_FLAG`, or
worse, ignore an unknown field entirely because the binary codec drops it).

## Expected vs actual

Expected: `keyof MPTokenIssuanceSet` is the literal union of its declared fields; `Omit<T, K>` removes
`K` and keeps the other fields required; an object literal with an unknown property is rejected.

Actual: `keyof` is `string | number`, `Omit<T, K>` is `Pick<T, Exclude<string | number, K>>` =
`{ [x: string]: unknown }`, and excess-property checking is disabled on every transaction literal.
Anyone building typed helpers over the transaction models (builders, form validators, partial
updaters) gets code that looks type-safe and is not, with no compiler error anywhere.

## Root cause

The "allow unknown future fields" escape hatch is baked into the base interface as an index
signature, so it leaks into every derived interface's key space.

## Proposed fix

Breaking for code that relies on assigning arbitrary extra keys to a typed transaction (rare, and
that code was never checked anyway). Move the escape hatch out of the named interfaces:

```ts
// common.ts
export interface BaseTransaction {          // no index signature
  Account: Account
  TransactionType: string
  ...
}

// transaction.ts
/** A transaction with possibly-unmodelled fields, for forward compatibility at API boundaries. */
export type LenientTransaction = Transaction & Record<string, unknown>
```

Then accept `LenientTransaction` (or `Record<string, unknown>`) only where forward-compatibility is
genuinely needed: `validate(transaction: Record<string, unknown>)` already does, `decode()` results,
and `Client.request` payloads. Internal validators already take `Record<string, unknown>`, so they are
unaffected. A migration note plus a codemod-free release is realistic because the compiler will
point at every site that relied on the index signature.

## Workaround today

Wrap the models locally before building utility types:

```ts
type Strict<T> = { [K in keyof T as string extends K ? never : K]: T[K] }
type StrictSet = Strict<MPTokenIssuanceSet>   // keyof is now the literal union
```

`Strict<T>` drops the index signature by filtering out `string` keys; it does not restore the
excess-property check on literals typed as the original interface.

## References

- Captain's seed document (`issues.md`, "Omit/Pick/Partial silently no-op")
- Related: [003](003-transaction-literals-widen-no-factory.md)
