# Portal before/after excerpts for the walkthrough deck

The **before** is the audit's corrected, current-release example using published xrpl 5.3.0. The **after** is the matching workflow using the **unreleased aha SDK prototype**. This is not a claim that npm already supplies the proposed APIs. Source paths below are relative to the portal fork. All imports remain ordinary `from 'xrpl'` imports; dependency selection lives in the separate prototype package.

## 1. Prepare, sign, submit: types follow the workflow

Before — `_code-samples/send-xrp/ts/send-xrp.ts`:

```ts
// Current SDK workaround: name Payment to expose optional autofilled fields.
const prepared = await client.autofill<Payment>(payment)
console.log('Prepared fee:', prepared.Fee)
const signed = sender.sign(prepared)
const confirmed = await client.submitAndWait(signed.tx_blob)
```

After — `_code-samples/devx-after/send-xrp.ts`:

```ts
const prepared = await client.autofill(payment)
console.log('Prepared fee:', prepared.Fee)
const signed = sender.sign(prepared)
const confirmed = await client.submitAndWait(signed.tx_blob)
// after the transaction-success check:
console.log(`Confirmed destination: ${confirmed.result.tx_json.Destination}`)
```

Editor story: choose a Payment; prepare it; see Fee as a populated string; sign it; still discover Payment fields on the validated response. The extra `<Payment>` workaround disappears. The unchanged runtime success check remains between response retrieval and the final destination log.

## 2. Validation guarantees parsed metadata, not business success

Before — `_code-samples/get-started/ts/get-acct-info.ts`:

```ts
const metadata = submitted.result.meta
if (metadata == null || typeof metadata === 'string') {
  throw new Error('Expected parsed transaction metadata')
}
if (metadata.TransactionResult !== 'tesSUCCESS') {
  throw new Error(`Payment failed: ${metadata.TransactionResult}`)
}
```

After — `_code-samples/devx-after/get-started.ts`:

```ts
const metadata = submitted.result.meta
if (metadata.TransactionResult !== 'tesSUCCESS') {
  throw new Error(`Payment failed: ${metadata.TransactionResult}`)
}
```

Editor story: `submitAndWait` already knows it requested parsed JSON and waited for validation, so its return type should reflect those guarantees. The developer still checks the actual result code.

## 3. MPT intent carries through creation and lookup

Before — `_code-samples/issue-mpt-with-metadata/ts/issue-mpt-with-metadata.ts`:

```ts
if (creationMetadata.mpt_issuance_id == null) {
  throw new Error('Successful issuance did not return an MPT issuance ID')
}
const issuanceId = creationMetadata.mpt_issuance_id
// after the ledger_entry request with mpt_issuance: issuanceId:
const node = entry.result.node
if (node.LedgerEntryType !== 'MPTokenIssuance' || node.MPTokenMetadata == null) {
  throw new Error('Expected an MPT issuance with metadata')
}
console.log('Metadata:', decodeMPTokenMetadata(node.MPTokenMetadata))
```

After — `_code-samples/devx-after/issue-mpt-with-metadata.ts`:

```ts
if (creationMetadata.mpt_issuance_id == null) {
  throw new Error('Successful issuance did not return an MPT issuance ID')
}
const issuanceId = creationMetadata.mpt_issuance_id
// after the same ledger_entry request:
const node = entry.result.node
if (node.MPTokenMetadata == null) {
  throw new Error('Expected an MPT issuance with metadata')
}
console.log('Metadata:', decodeMPTokenMetadata(node.MPTokenMetadata))
```

Editor story: a typed creation object already exposes issuance-specific metadata in 5.3.0 once parsed metadata is checked. The demonstrated new capability is that the MPT selector returns an MPT issuance. Optional ID and optional metadata remain explicit because these are genuine domain absences, not information already known from the request. Creation and update success checks remain in both complete files.

## 4. AMM: one honest result check per transaction

Before helper — `_code-samples/create-amm/ts/create-amm-guided.ts`:

```ts
function requireSuccess(response: TxResponse): void {
  const metadata = response.result.meta
  if (metadata == null || typeof metadata === 'string') {
    throw new Error('Expected parsed transaction metadata')
  }
  if (metadata.TransactionResult !== 'tesSUCCESS') {
    throw new Error(`Transaction ${response.result.hash} failed: ${metadata.TransactionResult}`)
  }
}
```

After helper — `_code-samples/devx-after/create-amm.ts`:

```ts
function requireSuccess(response: ValidatedTxResponse): void {
  const metadata = response.result.meta
  if (metadata.TransactionResult !== 'tesSUCCESS') {
    throw new Error(`Transaction ${response.result.hash} failed: ${metadata.TransactionResult}`)
  }
}
```

## Precisely scoped scaffolding changes

Across the four matched workflows (not across the whole SDK):

- **5** parsed-metadata type/absence guards removed, because these responses are now typed as validated and parsed.
- **2** MPT ledger-kind comparisons removed, one for the initial lookup and one for confirmation; optional metadata checks remain.
- **1** generic autofill argument removed; populated fields are inferred.
- The MPT-ID absence check is **unchanged**. Direct typed object submission already infers issuance metadata on 5.3.0; type loss after signing is demonstrated separately in Send XRP.
- **0** unsafe assertions or `any` introduced. The corrected current-release variants already have zero unsafe assertions or `any`.
- **All transaction-success checks remain.** These source changes do not establish a measured time saving or onboarding improvement.

`portal-prototype-examples.patch` holds the complete pairwise diff. Prototype compilation and isolated-ledger execution are recorded separately, after the SDK integration is final.
