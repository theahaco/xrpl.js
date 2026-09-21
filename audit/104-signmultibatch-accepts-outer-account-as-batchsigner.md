# `signMultiBatch` accepts the outer `Account` as a `BatchSigner` (which rippled rejects with `temBAD_SIGNER`), `validate` and `Wallet.sign` pass it through, and only `combineBatchSigners` strips it — silently, down to an empty `BatchSigners` array

Severity: minor
Category: runtime

## Affected surface

- `signMultiBatch` — `packages/xrpl/src/Wallet/batchSigner.ts:100-118` (`involvedAccounts` is every
  inner `Delegate ?? Account`, which includes the outer account whenever it authorizes an inner; the
  only gate is `:114 if (!involvedAccounts.has(batchAccount))`)
- The rule lives in the sibling function only: `batchSigner.ts:237-238`
  (`// A batch signer cannot be the outer account (rippled: temBAD_SIGNER)` … `.filter(… !== outerAccount)`)
- `validateBatch` — `models/transactions/batch.ts:139-167` (checks `BatchSigners` shape only)
- The authors know the rule: `test/wallet/batchSigner.test.ts:305-331` ("removes signer for Batch
  submitter") asserts that `combineBatchSigners` drops it

## Repro

Offline (`audit/README.md` round-6 log); ops key is the outer `Account` and the XLS-75 delegate of
the issuer's inner lock, holder co-signs its inner opt-in:

```
signMultiBatch(holder)                               -> BatchSigners [holder]
signMultiBatch(ops = outer Account) on same object   -> BatchSigners [ops]      (holder's real co-signature overwritten, see 102)
validate(batch with outer-account BatchSigner)       -> ok
Wallet.sign(ops) -> wire BatchSigners                -> [ops]                   (the forbidden signer on the wire)
combineBatchSigners([outer-only fragment])           -> BatchSigners []         (stripped silently; empty array emitted)
```

The single-fragment flow the repo's integration test uses (`signMultiBatch` → submit, no
`combineBatchSigners`) sends the forbidden entry to rippled. The ledger result rests on the SDK's
own `temBAD_SIGNER` comment and XLS-56; not exercised live.

## Expected vs actual

Expected: `signMultiBatch` throws `ValidationError('<account> is the Batch Account; it authorizes
the batch with Wallet.sign, not with a BatchSigner')`, or `validateBatch` rejects a `BatchSigner`
whose `Account` equals the outer `Account`.

Actual: accepted at every layer; the SDK's delegation rule ("the delegate is the required signer",
`batchSigner.ts:102-105`) actively tells a developer whose ops key is both outer account and
delegate to call `signMultiBatch(ops)` — which then also destroys the holder's co-signature via
[102](102-combinebatchsigners-drops-multisign-fragments-per-account.md).

## Root cause

The outer-account exclusion was implemented in the combiner, not in the signer or the validator.

## Proposed fix

Non-breaking:

```ts
// signMultiBatch, after computing batchAccount
if (batchAccount === transaction.Account) throw new ValidationError('signMultiBatch: the Batch Account signs with Wallet.sign, not as a BatchSigner')
// validateBatch
if (tx.BatchSigners?.some((s) => s.BatchSigner.Account === tx.Account)) throw new ValidationError('Batch: BatchSigners cannot include the Batch Account')
```

## Workaround today

Never pass the outer account (or a wallet for it) to `signMultiBatch`; sign the outer with
`Wallet.sign` only.

## References

- XLS-56 §BatchSigners
- Related: [090](090-signmultibatch-refuses-sponsor-of-inner-transaction.md), [099](099-validatebatch-misses-mode-flag-and-count-rules.md), [102](102-combinebatchsigners-drops-multisign-fragments-per-account.md)
