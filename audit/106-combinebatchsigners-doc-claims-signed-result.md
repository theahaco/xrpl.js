# `combineBatchSigners`' doc says it "creates a single transaction … that then gets signed and returned" and "@returns A single signed Transaction"; it returns an unsigned blob that still needs `Wallet.sign`

Severity: paper-cut
Category: docs

## Affected surface

- `combineBatchSigners` doc — `packages/xrpl/src/Wallet/batchSigner.ts:143-152`
- Implementation — `batchSigner.ts:189` (`return encode(getTransactionWithAllBatchSigners(batchTransactions))`;
  `:179` even requires inputs with no `TxnSignature`)
- The doc is copied from `Wallet.multisign` (`Wallet/signer.ts:10-15`), where it is true because
  `Signers` *are* the signatures; for Batch, `BatchSigners` is a non-signing field and the outer
  `Account` still has to sign

## Repro

Offline (`audit/README.md` round-7 log):

```
combined = combineBatchSigners([fragB, fragC])
decode(combined): outer TxnSignature present: false | SigningPubKey: undefined | BatchSigners: 2
hashes.hashSignedTx(combined)   -> ValidationError: The transaction must be signed to hash it.
verifySignature(combined)       -> Error: Transaction is missing a signature, TxnSignature
client.submit(combined)         -> ValidationError: Wallet must be provided when submitting an unsigned transaction
client.submit(combined, { wallet: outer }) -> ok
```

## Expected vs actual

Expected: "Merges the `BatchSigners` of several fragments into one **unsigned** Batch (returned as
a blob). The Batch `Account` must still sign it (`Wallet.sign`, or `client.submit(blob, { wallet })`)."

Actual: a developer following the doc hashes, verifies or submits the "signed" result and gets a
throw; nothing in README, HISTORY or the tests corrects it. Same copy-paste class as
[013](013-mptokenauthorize-docs-copy-pasted.md) and [044](044-simulate-doc-copy-pasted-from-submit.md).

## Root cause

Doc block copied from `multisign`.

## Proposed fix

Docs only; also state the required order (autofill → co-sign fragments → combine → outer sign →
submit with `autofill: false`), which [103](103-signmultibatch-has-no-autofill-precondition.md)
shows is otherwise undocumented.

## Workaround today

Sign the combined blob with the outer wallet.

## References

- Related: [103](103-signmultibatch-has-no-autofill-precondition.md), [105](105-no-batchsigner-verification-helper.md), [102](102-combinebatchsigners-drops-multisign-fragments-per-account.md)
