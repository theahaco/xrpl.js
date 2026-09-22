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

All four current after examples use wallet-bound transaction builders and named commands. Send XRP creates a payment draft and calls `signAndSubmit()`. MPT uses `mpTokenIssuanceCreate`, `mpTokenIssuanceSet` and `command.ledgerEntry`; its metadata encoder supplies contextual typing without `satisfies`. AMM binds issuer and provider clients once, then uses `accountSet`, `trustSet`, `payment` and `ammCreate`, plus named pool/balance queries. Getting Started uses the same pattern in both Node and browser entrypoints.

No after example requires `satisfies`, transaction-model annotations, repeated `TransactionType`/`Account`, command discriminators, raw result-code comparisons or parsed-transaction-metadata guards. Published 5.3.0 before examples retain the checks that release requires. Genuine domain checks remain: optional MPT issuance IDs/token metadata, optional validated-ledger availability, and the XRP/issued-token amount union.

[Open the live comparison](https://theahaco.github.io/xrpl-dev-portal/pr-1/). [All-example follow-up](guided-examples-follow-up.md) records the current source and runtime checks. Earlier autofill/signed-blob examples and their counts are historical evidence of those lower-level SDK improvements, not the current recommended teaching flow.

See [builder follow-up](builders-follow-up.md), [editor evidence](builders-editor.json), [runtime evidence](builders-runtime.json), [four prototype journeys](runtime-builders-prototype.json), and [matched failure evidence](runtime-negative-outcomes-builders.json). The earlier scaffolding counts describe the prior revision, not this final design.
