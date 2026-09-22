# Guided API across every after example

The four current prototype workflows and primary Getting Started Node/browser entrypoints all use `WalletClient` with named transaction builders. Transactions inherit their account and kind, sign with the bound wallet, and return successful validation or throw. Queries use named commands or existing typed convenience methods. MPT metadata fields are inferred at the encoder call.

There are no `satisfies` expressions, transaction-model annotations, repeated `TransactionType`/`Account`, raw command discriminators, manual signing/submission or protocol success-code comparisons in these six entrypoints. The before examples remain runnable representations of the published 5.3.0 API.

Send XRP now teaches draft construction followed by `signAndSubmit()`. MPT creates and updates through issuance builders and queries through `command.ledgerEntry()`. AMM uses separate wallet-bound issuer/provider clients for `accountSet`, `trustSet`, `payment` and `ammCreate`, then named server, pool and balance commands. Getting Started already used this pattern and was rechecked.

Domain checks remain where the value is genuinely optional: an MPT issuance ID or its token metadata, and a server's validated ledger. The AMM amount formatter still distinguishes XRP from issued tokens. These are different from parsing transaction metadata or interpreting protocol success codes.

## Verification

- All four prototype examples and both primary Getting Started entrypoints typecheck against the built SDK fork; the four prototype examples build.
- [Source check](guided-examples-source-check.json): six entrypoints checked, with exact source hashes.
- [Successful runtime workflows](runtime-guided-all-examples.json): 4/4 passed on the isolated standalone ledger, including MPT metadata update and AMM creation/LP-token queries. The first connection attempt raced ledger startup; the rerun after readiness passed.
- [Matched failed-payment outcomes](runtime-guided-example-failures.json): both published and prototype Send XRP examples surface a validated failure, with the sender charged only the fee and the recipient unchanged. The prototype uses the actual builder example and throws `TransactionFailedError`.
- Preview build checks pass: four journeys, 30 code/copy targets, byte-for-byte source downloads and 62 relative links.

The runtime harnesses now pass wallet-bound clients to each after example. They exercise exported `run()` workflows with fresh locally funded accounts. Public faucets, public-network amendment availability and browser runtime execution are outside this verification. Browser visual inspection remains blocked by the browser tool's policy-verification failure. The SDK library implementation was unchanged in this follow-up.

[Open the before/after preview](https://theahaco.github.io/xrpl-dev-portal/pr-1/). Earlier report/deck examples and autofill/signed-blob comparison records describe prior revisions; this follow-up and the live preview describe the current teaching flow.
