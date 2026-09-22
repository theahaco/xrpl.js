# Current before/after examples

The comparison target is published xrpl 5.3.0. The candidate is the unreleased aha fork. Earlier patch and runtime records remain historical evidence; the wallet-builder follow-up supersedes their caller-owned success checks.

## Discover, construct and submit a payment

The published comparison under `devx-before/get-started` names request/transaction models and guards the metadata before checking its protocol result code. The current primary Node/browser walkthrough uses:

```ts
const client = new WalletClient(server, { wallet })
await client.connect()
const account = await client.command.accountInfo({ account: client.wallet.address })
const submitted = await client.tx.payment({
  Amount: xrpToDrops('1'),
  Destination: destination.address
}).signAndSubmit()
console.log(`Payment confirmed: ${submitted.result.hash}`)
```

The wallet supplies Account; the factory supplies TransactionType. No annotation, `satisfies`, cast, metadata guard or protocol-code comparison is needed. The factory creates a draft; only the terminal method sends it. `.toJSON()` returns an independent copy for inspection.

## Explicit outcome handling

```ts
const outcome = await client.tx.payment({
  Amount: xrpToDrops('1'),
  Destination: destination.address
}).trySignAndSubmit()
if (outcome.ok) {
  console.log(outcome.response.result.hash)
} else {
  console.error(outcome.error.message)
}
```

The lower-level `submitAndWait` throws on failed validated transactions and `trySubmitAndWait` returns the same success/error union. `TransactionFailedError.response` retains the validated failed transaction. Transport or expiry errors can leave the outcome unknown, so applications must resolve that uncertainty before retrying.

## Other paired workflows

Send XRP still demonstrates inferred autofill fields and transaction identity preserved through signing. MPT selectors infer the requested ledger object. AMM setup awaits each successful transaction. All prototype workflows now rely on SDK success classification; published 5.3.0 examples retain their required checks. MPT ID/metadata absence checks and the unavailable validated-ledger check remain.

See [builder follow-up](builders-follow-up.md), [editor evidence](builders-editor.json), [runtime evidence](builders-runtime.json), [four prototype journeys](runtime-builders-prototype.json), and [matched failure evidence](runtime-negative-outcomes-builders.json). The earlier scaffolding counts describe the prior revision, not this final design.
