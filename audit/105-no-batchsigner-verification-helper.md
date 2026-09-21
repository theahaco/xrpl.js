# There is no way to verify a `BatchSigner` co-signature: `verifySignature` / `Wallet.verifyTransaction` check only the outer `TxnSignature` and return `true` for a Batch whose `BatchSigners` entries are garbage

Severity: minor
Category: missing-helper

## Affected surface

- `verifySignature` — `packages/xrpl/src/Wallet/signer.ts:67-91` (`:76` throws "Transaction is missing
  a signature, TxnSignature"; `:90` `verify(encodeForSigning(decodedTx), decodedTx.TxnSignature, key)`)
- `Wallet.verifyTransaction` — `packages/xrpl/src/Wallet/index.ts:450-452` (delegates to it)
- `BatchSigners` is a non-signing field (`packages/ripple-binary-codec/src/enums/definitions.json`
  `"isSigningField": false`), so the outer signature never covers it
- Building blocks exist and are exported but nothing composes them: `encodeForSigningBatch`,
  `verifyKeypairSignature` (`utils/index.ts`), `hashSignedTx`; `grep -rn verif packages/xrpl/src/Wallet/batchSigner.ts` → nothing

## Repro

Offline (`audit/README.md` round-6 log):

```
verifySignature(signed outer)                                  -> true
verifySignature(BatchSigner.TxnSignature = 'DEADBEEF')         -> true          <- misleading
verifySignature(BatchSigner.Account swapped)                   -> true
verifySignature(unsigned fragment with BatchSigners)           -> throws Transaction is missing a signature, TxnSignature
verifySignature(multisigned outer)                             -> throws Transaction is missing a signature, TxnSignature
exports with "verify": verifyKeypairSignature, verifyPaymentChannelClaim, verifySignature
hand-rolled: verifyKeypairSignature(encodeForSigningBatch({ account, sequence, flags, txIDs, batchAccount }), sig, pubkey) -> true; tampered inner -> false
```

## Expected vs actual

Expected: `verifyBatchSigner(batch, index?)` (or `verifySignature` understanding `BatchSigners`,
`Signers` and `SponsorSignature`) that rebuilds the XLS-56 V1_1 payload the way `signMultiBatch`
does and checks each entry, including the multisign `signerAccount` binding.

Actual: an issuer collecting co-signed fragments from holders (the multi-account onboarding batch)
has no offline check before combining/submitting, and the one verifier that exists answers a
different question with a misleading `true`. The payload format
(`account | sequence-or-ticket | flags | txIDs | batchAccount [| signerAccount]`,
`batchSigner.ts:119-129`) must be re-derived by the caller — the same hand-rolling
[090](090-signmultibatch-refuses-sponsor-of-inner-transaction.md) forces on the sponsor path.

## Root cause

`verifySignature` predates Batch, multisign verification and sponsorship; no Batch-aware verifier
was added with `signMultiBatch`.

## Proposed fix

Non-breaking addition (~15 lines, mirroring `signMultiBatch`):

```ts
export function verifyBatchSigners(batch: Batch): Array<{ account: string; valid: boolean }> {
  const txIDs = batch.RawTransactions.map((r) => hashSignedTx(r.RawTransaction))
  return (batch.BatchSigners ?? []).map(({ BatchSigner: s }) => {
    const payload = encodeForSigningBatch({ flags: batch.Flags, sequence: getBatchSeqValue(batch), account: batch.Account, txIDs, batchAccount: s.Account })
    if (s.Signers) return { account: s.Account, valid: s.Signers.every((x) => verifyKeypairSignature(payloadWith(x.Signer.Account), x.Signer.TxnSignature, x.Signer.SigningPubKey)) }
    return { account: s.Account, valid: verifyKeypairSignature(payload, s.TxnSignature, s.SigningPubKey) }
  })
}
```

and make `verifySignature` at least not claim `true` when `BatchSigners`/`Signers` are present
and unverified.

## Workaround today

The hand-rolled check above.

## References

- XLS-56 §BatchSigners signing payload
- Related: [090](090-signmultibatch-refuses-sponsor-of-inner-transaction.md), [102](102-combinebatchsigners-drops-multisign-fragments-per-account.md), [103](103-signmultibatch-has-no-autofill-precondition.md)
