# Non-`txnNotFound` failures during `submitAndWait` polling are re-thrown as a plain `Error` whose message starts with the literal `undefined`; the original error class and `data` are lost

Severity: minor
Category: runtime

## Affected surface

- `waitForFinalTransactionOutcome` catch block — `packages/xrpl/src/sugar/submit.ts:135-152`

```ts
.catch(async (error) => {
  const message = error?.data?.error as string          // undefined for TimeoutError / DisconnectedError
  if (message === 'txnNotFound') { return waitForFinalTransactionOutcome(…) }
  throw new Error(`${message} \n Preliminary result: ${submissionResult}.\nFull error details: ${String(error)}`)
})
```

## Repro

Offline against the built package (`audit/README.md` round-2 log, fake client whose `tx` request
rejects):

```
TimeoutError from tx request       -> Error (instanceof XrplError = false)
   "undefined \n Preliminary result: tesSUCCESS.\nFull error details: TimeoutError: …"
DisconnectedError from tx request  -> Error "undefined \n Preliminary result: tesSUCCESS. …"
RippledError tooBusy               -> Error "tooBusy \n Preliminary result: tesSUCCESS. …"   (data lost)
```

## Expected vs actual

Expected: the original `TimeoutError` / `DisconnectedError` / `RippledError` propagates (optionally
wrapped with `cause`), so a caller can distinguish "the node went away while I was waiting" (retry
the *lookup*) from "the transaction failed" (do not resubmit). `HISTORY.md` 2.2.x claims this path
was fixed to "properly show the preliminary result instead of a type error"; the `undefined` prefix
remains for every non-rippled error.

Actual: a fourth failure shape on top of the three in
[025](025-submitandwait-three-failure-surfaces-no-result-helper.md): `instanceof` checks fail,
`data` is gone, and the message begins with `undefined`.

## Root cause

The catch assumes every error is a `RippledError` with `data.error`.

## Proposed fix

Non-breaking:

```ts
.catch((error: unknown) => {
  if (error instanceof RippledError && error.data?.error === 'txnNotFound') { return waitForFinalTransactionOutcome(…) }
  if (error instanceof XrplError) { throw error }                       // keep class + data
  throw new XrplError(`Failed to look up ${txHash}. Preliminary result: ${submissionResult}`, { cause: error })
})
```

(typed `data` per [035](035-rippled-error-data-untyped.md)).

## Workaround today

Catch, then `String(err.message).includes('Preliminary result')` and re-query `tx` by hash.

## References

- Related: [025](025-submitandwait-three-failure-surfaces-no-result-helper.md), [035](035-rippled-error-data-untyped.md), [062](062-submitandwait-expiry-check-precedes-final-tx-lookup.md)
