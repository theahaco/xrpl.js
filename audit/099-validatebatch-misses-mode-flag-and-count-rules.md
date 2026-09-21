# `validateBatch` enforces none of rippled's Batch-level preflight rules (exactly one mode flag, 2–8 inner transactions); rippled's `simulate` cannot dry-run a `Batch` at all

Severity: minor
Category: validation

## Affected surface

- `validateBatch` — `packages/xrpl/src/models/transactions/batch.ts:115` (checks nesting,
  `tfInnerBatchTxn`, inner `Fee`/`SigningPubKey`/`TxnSignature`/`Signers`/`LastLedgerSequence`
  only); `validateBatchInnerTransaction` — `:70`
- Reached from `signMultiBatch` (`Wallet/batchSigner.ts:96`) and `combineBatchSigners` (`:172`),
  so every co-signer signs a malformed batch before rippled rejects it
- The repo's own "verifies valid Batch" fixture uses `Flags: 1`
  (`test/models/batch.test.ts:30`), which is not a Batch mode flag

## Repro

Live (rippled 3.4.0-rc1, `audit/README.md` round-4 log), each case passes `validate()`:

```
no mode flag                                  submit -> temINVALID_FLAG
two mode flags (tfAllOrNothing|tfIndependent) submit -> temINVALID_FLAG
one inner txn                                 submit -> temARRAY_EMPTY
zero inner txns                               submit -> temARRAY_EMPTY
nine inner txns                               submit -> RPC error: Batch has too many inner transactions.
duplicate identical inner txn                 submit -> tesSUCCESS   (no preflight rule; dropped from this finding)
```

And for every one of them, `client.simulate(batch)` answers `RPC error: Not implemented.` —
rippled's `simulate` does not support `Batch`, so there is no fee-free way to preview a batch; the
client-side validator is the only pre-submission check, and it is empty for these rules.

## Expected vs actual

Expected: `ValidationError`s for "exactly one of `tfAllOrNothing | tfOnlyOne | tfUntilFailure |
tfIndependent`" and "2 ≤ `RawTransactions.length` ≤ 8" (both decidable offline), and a note on
`Client.simulate` that `Batch` is not supported by rippled.

Actual: all pass `validate()`; the errors come back as `tem*` (through the
[025](025-submitandwait-three-failure-surfaces-no-result-helper.md) prose throw) after the
co-signers have already signed.

Additional surface (verified offline): `signMultiBatch` on a flagless batch does not fail in
`validate()` but in the codec — `encodeForSigningBatch` throws a bare ``Error: No field `flags` ``
(`packages/xrpl/src/Wallet/batchSigner.ts:122` binds `transaction.Flags` unconverted) — so the
first co-signer gets an unexplained codec error instead of "exactly one mode flag is required".

Round-6 addition (verified offline): `validate()` also accepts `Delegate` on the outer `Batch`
although `delegateSet.ts:12-23` lists `Batch` among `NON_DELEGABLE_TRANSACTIONS`; the rule exists
in the SDK and is not applied where the transaction is built.

## Root cause

`validateBatch` was written around the inner-transaction constraints only.

## Proposed fix

Non-breaking:

```ts
const MODE_FLAGS = [tfAllOrNothing, tfOnlyOne, tfUntilFailure, tfIndependent]
const modes = MODE_FLAGS.filter((f) => (flags & f) !== 0).length
if (modes !== 1) throw new ValidationError('Batch: exactly one mode flag (tfAllOrNothing, tfOnlyOne, tfUntilFailure, tfIndependent) is required')
if (tx.RawTransactions.length < 2 || tx.RawTransactions.length > 8) throw new ValidationError('Batch: RawTransactions must contain between 2 and 8 transactions')
```

and fix the unit-test fixture to a real mode flag. On `Client.simulate`: "`Batch` transactions
are not supported by rippled's `simulate` (`Not implemented`)."

## Workaround today

Check the flag and count in application code; there is no dry-run for batches.

## References

- XLS-56 §Flags, §RawTransactions (2–8); rippled `Batch::preflight`
- Related: [092](092-batch-type-admits-what-validatebatch-rejects.md), [088](088-batch-outcome-silent-no-inner-results.md), [030](030-simulate-does-not-thread-transaction-type.md)
