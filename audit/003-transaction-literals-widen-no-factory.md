# Transaction object literals held in a variable widen `TransactionType` to `string`; the SDK ships no typed factory

Severity: minor
Category: missing-helper

## Affected surface

- `SubmittableTransaction` union — `packages/xrpl/src/models/transactions/transaction.ts:178-243`
- Every `Client` entry point taking `T extends SubmittableTransaction` (`autofill`, `submit`,
  `submitAndWait`, `simulate`) — `packages/xrpl/src/client/index.ts:685, 738, 790, 862`

## Repro

```ts
const tx = {
  TransactionType: 'MPTokenIssuanceSet',
  Account: wallet.classicAddress,
  MPTokenIssuanceID: issuanceId,
  Flags: 1,
}
await client.submitAndWait(tx, { wallet })
// TS2345: Argument of type '{ TransactionType: string; ... }' is not assignable to parameter of type
//   'string | SubmittableTransaction'. Type 'string' is not assignable to type '"AccountSet" | ...'
```

Compiled repro: `audit/mpt-issuer/src/type-repros/repros.ts` (`audit003`). The issuer project works
around it by annotating every builder's return type (`audit/mpt-issuer/src/holders.ts:13-46`,
`freeze.ts:15-51`, `ban.ts:41-48`).

## Expected vs actual

Expected: building a transaction value and passing it to the client "just works", with the compiler
checking the shape for the chosen `TransactionType` and rejecting fields that do not belong.

Actual: an un-annotated literal widens its discriminant to `string` and is rejected by every entry
point; callers learn to sprinkle `: Payment` annotations, `as const`, or `satisfies Payment`. Inline
literals passed straight to the API are fine (contextual typing), so the failure looks arbitrary to
newcomers. And because of [004](004-basetransaction-record-string-unknown-collapses-keyof.md), even an
annotated literal is not checked for typos in field names.

## Root cause

Standard TypeScript literal widening, plus no helper in the SDK that fixes the discriminant at the
construction site. This is arguably not a defect in the SDK's types; it is a missing ergonomic.

## Proposed fix

Non-breaking. Add a tiny generic factory that narrows by `TransactionType` and performs the
excess-property check at the call site:

```ts
// models/transactions/index.ts
export type TransactionOf<K extends SubmittableTransaction['TransactionType']> =
  Extract<SubmittableTransaction, { TransactionType: K }>

export function tx<K extends SubmittableTransaction['TransactionType']>(
  fields: TransactionOf<K>,
): TransactionOf<K> {
  return fields
}

// usage
const set = tx({ TransactionType: 'MPTokenIssuanceSet', Account, MPTokenIssuanceID, Flags: 1 })
//    ^? MPTokenIssuanceSet
```

The excess-property check only becomes meaningful once
[004](004-basetransaction-record-string-unknown-collapses-keyof.md) is fixed; until then the factory
still fixes the discriminant and enables autocomplete.

## Workaround today

Annotate (`const tx: MPTokenIssuanceSet = {...}`), use `satisfies MPTokenIssuanceSet`, or pass the
literal inline.

## References

- Captain's seed document (`issues.md`, "transaction object literals require as const/satisfies")
- Related: [004](004-basetransaction-record-string-unknown-collapses-keyof.md)
