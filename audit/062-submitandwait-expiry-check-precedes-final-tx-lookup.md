# `waitForFinalTransactionOutcome` throws "expired" before its final `tx` lookup, so a transaction validated in its last allowed ledger is reported as failed with "Preliminary result: tesSUCCESS"

Severity: major
Category: runtime

## Affected surface

- `waitForFinalTransactionOutcome` — `packages/xrpl/src/sugar/submit.ts:119-134`
  (`sleep` → `getLedgerIndex()` → `if (lastLedger < latestLedger) throw` → only then `request({ command: 'tx' })`)
- `Client.submitAndWait` — `packages/xrpl/src/client/index.ts:892-898`

## Repro

Live (rippled 3.4.0-rc1, ledgers closing every 400 ms, `audit/README.md` round-2 log): an MPT
`Payment` submitted with `LastLedgerSequence = validated + 2`:

```
[e2] tight LastLedgerSequence: THREW after 1070ms
  The latest ledger sequence 715 is greater than the transaction's LastLedgerSequence (714). | Preliminary result: tesSUCCESS
  || last txs: Payment:tesSUCCESS:validated=true, …
```

`account_tx` immediately afterwards shows the same Payment **validated with `tesSUCCESS`**. The
tokens moved; the caller was told the transaction expired.

## Expected vs actual

Expected: after the sleep, look the transaction up; if `validated`, return it; only if it is not
found *and* the latest validated ledger is past `LastLedgerSequence` report expiry. (This was the
original order: `git show 07f36e12` reorders `tx`-then-compare into compare-then-`tx`.)

Actual: whenever two or more ledgers close between polls (`LEDGER_CLOSE_TIME` is a fixed 1 s sleep;
mainnet closes every 3–5 s but latency, queueing and `fee`-based retries make tight windows common;
a standalone/test node like this one closes faster than the poll), a transaction that lands in
ledger `L = LastLedgerSequence` is reported as expired. For a compliance issuer the failure mode is an
**operator retrying a "failed" Clawback and clawing back twice**, or re-issuing a lock that already
applied and logging it as new.

## Root cause

Check ordering; the expiry test uses the *current* validated index rather than the ledger the
transaction would have been in.

## Proposed fix

Non-breaking:

```diff
   await sleep(LEDGER_CLOSE_TIME)
-  const latestLedger = await client.getLedgerIndex()
-  if (lastLedger < latestLedger) { throw new XrplError(…) }
   const txResponse = await client.request({ command: 'tx', transaction: txHash }).catch(…)
   if (txResponse.result.validated) { return txResponse }
+  const latestLedger = await client.getLedgerIndex()
+  if (lastLedger < latestLedger) {
+    throw new TransactionFailedError(submissionResult, undefined, 'expired')   // see 025
+  }
   return waitForFinalTransactionOutcome(…)
```

and, in the `txnNotFound` branch, apply the same ledger comparison before recursing so a truly
expired transaction still terminates.

## Workaround today

On the expiry error, query `tx` by hash (the SDK exposes `hashes.hashSignedTx`) before treating the
transaction as failed; `audit/mpt-issuer/src/tx.ts` does not (it trusts the SDK), which is exactly
the point.

## References

- xrpl.org "Reliable Transaction Submission" (final outcome must be read from a validated ledger)
- Related: [025](025-submitandwait-three-failure-surfaces-no-result-helper.md), [043](043-submitandwait-throws-doc-claims-tec-rejects.md)
