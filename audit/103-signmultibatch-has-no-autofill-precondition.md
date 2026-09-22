# `signMultiBatch` happily signs a Batch that has not been autofilled, binding `Sequence` 0 and inner hashes computed without `Sequence`/`Fee`/`SigningPubKey`; `submitAndWait`'s default autofill then changes both, so the co-signatures can never verify

Severity: minor
Category: runtime

## Affected surface

- `signMultiBatch` — `packages/xrpl/src/Wallet/batchSigner.ts:96` (`validate` accepts inners
  without `Sequence`; `batch.ts:70-106` requires none), `:119-125` (`sequence:
  getBatchSeqValue(transaction)` → 0 when unset; `txIDs` from `hashSignedTx(rawTx.RawTransaction)`
  as-is), `:55-61`
- `getSignedTx` — `packages/xrpl/src/sugar/submit.ts:255` (autofill runs *after* the caller's
  co-signing and preserves `BatchSigners`)
- Neither `signMultiBatch`'s nor `submitAndWait`'s doc states the required order; only the
  integration test encodes it (`test/integration/transactions/batch.test.ts:94-96`: autofill → sign → submit)

## Repro

Offline (`audit/README.md` round-5 log):

```
signMultiBatch on un-autofilled batch          -> ok, BatchSigners set
inner hashes signed over                        [3D3DC352, 7F340921]
inner hashes after autofill                     [530B268E, A2DC07A3]   (Sequence/Fee/SigningPubKey now present)
outer Sequence bound at signing: 0 ; after autofill: 100
BatchSigners survive autofill: true
```

The signing payload (`encodeForSigningBatch`: flags, outer sequence, inner tx IDs) no longer
matches what rippled reconstructs from the submitted batch; the co-signatures are dead on
arrival (a signature-check `tem*`/`tef*`, not exercised live).

## Expected vs actual

Expected: `signMultiBatch` refuses an un-autofilled batch with a `ValidationError` ("autofill the
Batch first — inner Sequence/Fee/SigningPubKey and the outer Sequence/TicketSequence are bound
into the signature"), or its doc says so and `submitAndWait` refuses to autofill a batch that
already carries `BatchSigners`.

Actual: silent at every SDK layer; the failure is loud on the ledger, which is why this is minor.

## Root cause

No precondition on the signing helper; autofill and co-signing are order-sensitive and undocumented.

## Proposed fix

Non-breaking: in `signMultiBatch`, throw if the outer has neither `Sequence` nor `TicketSequence`
or any inner lacks `Sequence`/`Fee`/`SigningPubKey`; in `getSignedTx`, if `tx.BatchSigners` is
present and autofill would change anything, throw instead of silently invalidating the signatures.
Document the order on both functions.

## Workaround today

Always `await client.autofill(batch)` before any `signMultiBatch`, then submit with
`autofill: false`.

## References

- XLS-56 §BatchSigners signing payload
- Related: [099](099-validatebatch-misses-mode-flag-and-count-rules.md), [102](102-combinebatchsigners-drops-multisign-fragments-per-account.md)
