# `combineBatchSigners` keeps one `BatchSigner` fragment per account, so a multisigned `BatchSigner` (an issuer with a SignerList co-signing someone else's Batch) silently loses every co-signature but one; `signMultiBatch` overwrites rather than appends

Severity: major
Category: runtime

## Affected surface

- `getTransactionWithAllBatchSigners` — `packages/xrpl/src/Wallet/batchSigner.ts:245-253`
  (dedup by `account !== lastAccount`; keeps the first fragment; never merges `BatchSigner.Signers`)
- `signMultiBatch` — `batchSigner.ts:133-140` (`transaction.BatchSigners = [ … ]`, overwrite)
- Contrast `Wallet.multisign` — `packages/xrpl/src/Wallet/signer.ts:122` (`flatMap`s every
  fragment's `Signers`)
- `HISTORY.md:23` advertises BatchV1_1 support for both functions; `test/wallet/batchSigner.test.ts`
  covers only single-fragment multisign and distinct-account combining

## Repro

Offline (`audit/README.md` round-5 log): the issuer holds a SignerList (`c1`, `c2`); each
co-signer signs a fragment of the same autofilled batch for the issuer's inner lock:

```ts
signMultiBatch(c1, frag1, { batchAccount: issuer, multisign: true })
signMultiBatch(c2, frag2, { batchAccount: issuer, multisign: true })
decode(combineBatchSigners([frag1, frag2])).BatchSigners  // -> [{ Account: issuer, Signers: [1 entry] }]
decode(combineBatchSigners([frag2, frag1])).BatchSigners  // -> [{ Account: issuer, Signers: [1 entry] }]  (order-dependent which one)
```

versus `Wallet.multisign([…])` on a plain transaction → 2 `Signers`.

## Expected vs actual

Expected: one `BatchSigner` for the issuer carrying both `Signer`s (sorted), like `multisign`
does; or an error at combine time.

Actual: silently under-signed, and which co-signature survives depends on input order. XLS-56
checks `BatchSigner.Signers` against the account's SignerList quorum, so rippled rejects the
batch (a `tef*`-class bad-quorum result, which `submitAndWait` polls until expiry per
[025](025-submitandwait-three-failure-surfaces-no-result-helper.md); the exact code was not
exercised live because it requires a SignerList setup). A compliance issuer is precisely the
account that keeps its keys in a SignerList, and "ops key submits the Batch, issuer co-signs the
inner lock + clawback" is the multi-account shape [090](090-signmultibatch-refuses-sponsor-of-inner-transaction.md)
also targets — so there is no working co-signing path for a multisig issuer.

## Root cause

The BatchV1_1 change (`55764b0b`, #3371) deduplicated fragments by account without merging their
`Signers` arrays.

## Proposed fix

Non-breaking:

```ts
// getTransactionWithAllBatchSigners: group fragments by BatchSigner.Account; for groups with
// `Signers`, concatenate and sort the Signers (as multisign does); throw on two fragments that
// carry a plain `SigningPubKey`/`TxnSignature` for the same account.
// signMultiBatch: append to transaction.BatchSigners instead of overwriting.
```

plus a unit test with two multisign fragments for one account.

## Workaround today

Build the merged `BatchSigner` object by hand from the fragments.

## References

- XLS-56 §BatchSigners (multi-signature `Signers` per `BatchSigner`)
- Related: [090](090-signmultibatch-refuses-sponsor-of-inner-transaction.md), [099](099-validatebatch-misses-mode-flag-and-count-rules.md), [103](103-signmultibatch-has-no-autofill-precondition.md)
