# `submitAndWait` types `meta` as `TransactionMetadata<T> | string | undefined` although neither `string` nor `undefined` can occur on that path

Severity: major
Category: types

## Affected surface

- `Client.submitAndWait` — `packages/xrpl/src/client/index.ts:862-874` (returns `Promise<TxResponse<T>>`)
- `BaseTxResult.meta` — `packages/xrpl/src/models/methods/tx.ts:75` (`meta?: TransactionMetadata<T> | string`)
- `waitForFinalTransactionOutcome` — `packages/xrpl/src/sugar/submit.ts:111-166`

## Repro

```ts
const res = await client.submitAndWait(createTx, { wallet })
const code: string = res.result.meta.TransactionResult
// TS2339: Property 'TransactionResult' does not exist on type 'string | TransactionMetadata<...> | undefined'.
const code2: string = res.result.meta!.TransactionResult
// TS2339: Property 'TransactionResult' does not exist on type 'string'.
```

Hit in the issuer project at `audit/mpt-issuer/src/tx.ts:14-31` (`requireMeta`), which exists only to
narrow this union at runtime, and compiled as a `@ts-expect-error` repro at
`audit/mpt-issuer/src/type-repros/repros.ts` (`audit001`).

The repo's own integration tests carry the same workaround 18 times
(`grep -rn 'as TransactionMetadata' packages/xrpl/test`), e.g.
`packages/xrpl/test/integration/transactions/clawback.test.ts:143-144`,
`.../mptokenAuthorize.test.ts:53-54`, `.../payment.test.ts:141-144`.

## Expected vs actual

Expected: after `submitAndWait` resolves, `result.meta` is `TransactionMetadata<T>`. The sugar only
returns once `txResponse.result.validated` is true (`submit.ts:154-158`) and every validated `tx`
response carries decoded metadata; it never sets `binary: true` (`submit.ts:130-134`).

Actual: the return type reuses the general `TxResponse<T>` shape written for the raw `tx` RPC, whose
`meta` is optional (pending transactions) and may be a hex string (`binary: true`). Both branches are
structurally unreachable on the `submitAndWait` path, yet every caller must guard against them or
cast. `!` does not help because it only strips `undefined`, not `string`.

## Root cause

`TxResponse<T>` has no type parameter for the binary/JSON choice, unlike `simulate`, which already
models it with `Binary extends boolean = false` (`client/index.ts:738-746`,
`models/methods/simulate.ts:30-36`). `waitForFinalTransactionOutcome` returns the raw
`client.request({ command: 'tx' })` result with a cast (`submit.ts:155-157`, marked
`// TODO: resolve the type assertion below`).

## Proposed fix

Non-breaking, type-only. Add a `Binary` parameter to `BaseTxResult`/`TxResponse`, default `false`,
and make `submitAndWait` return the validated, JSON-only shape:

```ts
// models/methods/tx.ts
interface BaseTxResult<Version extends APIVersion = typeof DEFAULT_API_VERSION,
                       T extends BaseTransaction = Transaction,
                       Binary extends boolean = boolean,
                       Validated extends boolean = boolean> {
  ...
  meta?: Binary extends true ? string : TransactionMetadata<T>
  validated?: Validated
}
export interface TxResponse<T extends BaseTransaction = Transaction,
                            Binary extends boolean = boolean> extends BaseResponse {
  result: BaseTxResult<typeof RIPPLED_API_V2, T, Binary> & { tx_json: T }
}
/** What submitAndWait resolves with: validated, JSON metadata present. */
export type ValidatedTxResponse<T extends BaseTransaction = Transaction> = TxResponse<T, false> & {
  result: { meta: TransactionMetadata<T>; validated: true }
}
```

```ts
// client/index.ts
public async submitAndWait<T extends SubmittableTransaction = SubmittableTransaction>(
  transaction: T | string, opts?: ...
): Promise<ValidatedTxResponse<T>>
```

`waitForFinalTransactionOutcome` already checks `validated` at runtime; make that check the type
guard instead of the cast. Existing callers that guard `typeof meta === 'string'` keep compiling
(the guard becomes dead code, not an error).

## Workaround today

```ts
const meta = res.result.meta
if (meta === undefined || typeof meta === 'string') throw new Error('unexpected meta')
meta.TransactionResult // ok
```

or the cast the repo's tests use: `res.result.meta as TransactionMetadata<MPTokenIssuanceCreate>`.

## References

- `packages/xrpl/src/sugar/submit.ts:130-158` (no `binary`, returns only when `validated`)
- `packages/xrpl/src/client/index.ts:738-746` (`simulate` already models `Binary`)
- Captain's seed document (`issues.md`, "`submitAndWait` issue", root cause 2)
- Related: [002](002-wallet-sign-erases-transaction-type.md), [025](025-submitandwait-three-failure-surfaces-no-result-helper.md)
