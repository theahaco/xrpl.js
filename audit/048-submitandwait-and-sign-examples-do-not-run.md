# The `@example` blocks on `Client.submitAndWait` and `Wallet.sign` do not compile or run, and the `submitAndWait` prose is inverted

Severity: paper-cut
Category: docs

## Affected surface

- `Client.submitAndWait` `@example` — `packages/xrpl/src/client/index.ts:812-845`
- `Wallet.sign` `@example` — `packages/xrpl/src/Wallet/index.ts:318-349`
- `Client.fundWallet` is `async` — `client/index.ts:1223-1229`

## Repro

`submitAndWait` example (verbatim excerpts):

```ts
const senderWallet = client.fundWallet()          // not awaited: a Promise; .address is undefined
const recipientWallet = client.fundWallet()
…
await client.submit(signedTransaction, { wallet: senderWallet })   // `signedTransaction` is never declared
console.log(result)                                                // `result` is never declared
```

The example for `submitAndWait` never calls `submitAndWait`, and the prose below it reads:

> This is similar to `submit`, which does all of the above, but also waits to see if the transaction
> has been validated.

(`submit` does not wait; `submitAndWait` does.)

`Wallet.sign` example:

```ts
const { balance: balance1, wallet: wallet1 } = client.fundWallet()   // destructures a Promise
…
try {
  const { tx_blob: signed_tx_blob, hash} = await wallet1.sign(transaction)   // block-scoped
} catch (error) { … }
const result = await client.submit(signed_tx_blob)   // ReferenceError / TS2304 outside the block
```

## Expected vs actual

Expected: examples that paste and run; they are the first thing a developer copies for the two
most-used calls.

Actual: both fail at compile (TS2304) and at runtime (`undefined.address`, ReferenceError); the
`submitAndWait` example demonstrates `submit`.

## Root cause

Examples not compiled; the `submitAndWait` block was copied from `submit` and half-edited.

## Proposed fix

Docs only:

```ts
const { wallet: sender } = await client.fundWallet()
const { wallet: recipient } = await client.fundWallet()
const response = await client.submitAndWait(
  { TransactionType: 'Payment', Account: sender.address, Destination: recipient.address, Amount: '10' },
  { wallet: sender },
)
console.log(response.result.meta)   // TransactionResult etc.
```

and for `sign`: `await` the funding, hoist `signed_tx_blob`, submit inside the `try`. Reword:
"Like `submit`, but additionally waits until the transaction is validated (or can no longer be)."
Consider compiling `@example` blocks in CI (typedoc + `tsc` on extracted snippets).

## Workaround today

None needed.

## References

- Related: [043](043-submitandwait-throws-doc-claims-tec-rejects.md), [002](002-wallet-sign-erases-transaction-type.md)
