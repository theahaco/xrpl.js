# `autofill`'s Batch fee has no term for `BatchSigners`, and the only knob (`signersCount`) is documented as "only used for multisigned transactions" while the repo's own test passes it for a `BatchSigner`

Severity: minor
Category: docs

## Affected surface

- `calculateFeePerTransactionType` Batch branch — `packages/xrpl/src/sugar/autofill.ts:394-406`
  (`baseFee × 2 + Σ inner fees`; no `BatchSigners` term)
- `Client.autofill` doc — `client/index.ts:676-677`: "`signersCount` - The expected number of
  signers for this transaction. Only used for multisigned transactions."
- The SDK's own convention says otherwise: `test/integration/transactions/batch.test.ts`
  (`'batch multisign'` calls `client.autofill(tx, 1)` for one `BatchSigner`);
  `src/confidential/types.ts:237-243` documents `signersCount` as "the outer account's own
  multisign signers, plus one for each co-signing participant"

## Repro

Live (rippled 3.4.0-rc1, base fee 200 drops, `audit/README.md` round-3 log): a two-account batch
(holder opt-in + issuer authorize) autofilled with and without `signersCount`:

```
autofill(batch)      -> Fee = 960    (2×200 + 200 + 200, ×1.2 cushion)
autofill(batch, 1)   -> Fee = 1200   (one more base fee)
```

The audit's attempt to submit both and observe `telINSUF_FEE_P` vs `tesSUCCESS` failed earlier
with `temBAD_SIGNER` (a mistake in the audit's own multi-signer construction), so the on-ledger
fee requirement is asserted here on the strength of the repo's own passing integration test and
XLS-56's fee formula (one base fee per `BatchSigner`), not re-verified live.

## Expected vs actual

Expected: either `autofill` counts `BatchSigners` from `RawTransactions` (distinct
`Account`/`Delegate`/`Sponsor` other than the outer `Account`), or the `signersCount` doc says
"multisign signers plus one per `BatchSigner`".

Actual: a developer following the `autofill` doc under-fees every multi-account batch by one base
fee per co-signer and gets `telINSUF_FEE_P`, a `tel*` result that `submitAndWait` neither throws
on nor resolves until `LastLedgerSequence` passes ([025](025-submitandwait-three-failure-surfaces-no-result-helper.md)).

## Root cause

Batch fee logic written for single-account batches; the doc was not updated when `signersCount`
grew a second meaning.

## Proposed fix

Docs (S): correct the `signersCount` sentence. Code (S): in the Batch branch,
`batchSigners = new Set(inner accounts ≠ outer).size` and add `baseFee × batchSigners`, so
`signersCount` reverts to meaning multisign only.

## Workaround today

`client.autofill(batch, numberOfBatchSigners)` as the repo's test does.

## References

- XLS-56 §Fee
- Related: [025](025-submitandwait-three-failure-surfaces-no-result-helper.md), [088](088-batch-outcome-silent-no-inner-results.md)
