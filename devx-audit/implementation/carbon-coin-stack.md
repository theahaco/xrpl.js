# Carbon Coin follow-up stack

Tracking epic: https://github.com/theahaco/xrpl.js/issues/58

1. Outcomes and optional ledger reads: integrates relevant helper code from #54/#38 and the final-lookup ordering from #45, retaining #57's validated-success contract and retryable preliminary-result polling. Also brings in exact MPT unit conversions from #54. This is an integration onto #57, not a replacement for those focused proposals.
2. Account-bound builders and wallet scopes on one connection.
3. Immutable multisig preparation and co-signing.
4. Advisory MPT readiness, complete payment history and browser-safe memo helpers.
5. Carbon Coin consumes the final SDK pin and demonstrates deleted app scaffolding.

No npm release or upstream repository writes are part of this stack. Proposed APIs are exercised in the downstream application before being described as complete.

## Account and wallet scopes

```ts
const issuer = client.forAccount(issuerAddress)
const draft = issuer.tx.payment({ Amount, Destination })
const unsigned = await draft.prepare() // external single signer
await client.withWallet(wallet).tx.payment({ Amount, Destination }).signAndSubmit()
// Regular keys keep the transaction account distinct from the signing wallet:
await issuer.withWallet(regularKey).tx.accountSet({}).signAndSubmit()
```

Scopes share the original connection and request settings. Creating one opens no
socket, and address-only drafts expose no local signing method. Factory names,
field completion and strict input checking remain the same in either scope.

## Immutable multisig preparation

```ts
await client.forAccount(issuerAddress).tx.payment({ Amount, Destination })
  .multisignAndSubmit(localWallets)

const proposal = await client.forAccount(issuerAddress).tx.payment({ Amount, Destination })
  .prepareMultisig({ signersCount: 2 })
const signed = proposal.sign(firstWallet).addSignature(externalSignedBlob)
await signed.submit()
```

`signersCount` budgets actual signatures; it is not a weighted quorum. Every
signature is verified against the same canonical payload. Duplicate signers,
changed fields and excess signatures are rejected before submission. Signer-list
authority, regular-key authorization and quorum remain ledger checks.

External ceremonies can explicitly choose `expiry: 'none'`; such payloads can be
handed off with `toJSON()` / `toBlob()` but cannot use the bounded wait method.
They remain usable until the sequence is consumed and need deliberate handling
in the app. Default preparation retains the SDK's bounded ledger expiry.

## MPT workflow checks and history

```ts
const eligibility = await client.getMptTransferReadiness({
  account: issuerAddress, destination, mptIssuanceId, amount: rawUnits,
})
const history = await client.getMptPaymentHistory(issuerAddress, mptIssuanceId)
const memo = encodeMemo({ type: 'mint-period', data: '2026' })
```

Eligibility reads share one validated ledger index. The result distinguishes
blocked checks from unknown domain credentials/transfer fees and enumerates what
was not checked (fees/reserves, signing authority, expiry, destination settings,
complex payment options). `eligible` means only the checks performed passed;
re-check before signing, and rely on validated submission for success.

History follows every marker within a pinned available ledger range and rejects
changed ranges or repeated markers. It filters outgoing, validated, successful
payments of the requested MPT. Its `deliveredAmount` is absent if historical
metadata cannot establish the delivered value; a partial payment's requested
amount is never substituted. API v1 is explicit internally to preserve the
submitted `Amount` field pending separate response-model work in #48.

Memo helpers use UTF-8 browser primitives and reject malformed hex or non-text
payloads. Exact unit conversions from #54 were integrated in the first layer.
The source-pinned package is now `5.3.0-aha.devx.1`; nothing is published to npm.

Protocol references: [MPToken flags](https://xrpl.org/docs/references/protocol/ledger-data/ledger-entry-types/mptoken),
[issuance capabilities](https://xrpl.org/docs/references/protocol/ledger-data/ledger-entry-types/mptokenissuance),
[sending MPTs](https://xrpl.org/docs/tutorials/payments/send-an-mpt).
