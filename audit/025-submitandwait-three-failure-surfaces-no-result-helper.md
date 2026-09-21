# `submitAndWait` reports failure through three unrelated surfaces (`tem*` throws, `tec*` resolves, `tef*`/`ter*` time out) and ships no helper to read the engine result

Severity: major
Category: runtime

## Affected surface

- `Client.submitAndWait` — `packages/xrpl/src/client/index.ts:874-898`
  (`if (response.result.engine_result.startsWith('tem')) throw new XrplError(…)`)
- `waitForFinalTransactionOutcome` — `packages/xrpl/src/sugar/submit.ts:119-128`
  (`throw new XrplError("The latest ledger sequence … Preliminary result: …")`)
- `TransactionMetadataBase.TransactionResult: string` — `packages/xrpl/src/models/transactions/metadata.ts:90`
- `utils/index.ts` — no result-code helper (the captain's `origin/add-transaction-result-helpers`
  branch adds `getTransactionResultCode` / `isTesSuccess`; unmerged)

## Repro

Observed on rippled 3.4.0-rc1 through `audit/mpt-issuer/src/tx.ts`:

| wrong usage                                   | what `submitAndWait` does                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `Clawback` with `value: "0"`                   | throws `XrplError("Transaction failed, temBAD_AMOUNT: Can only send positive amounts.")`  |
| `Payment` to a locked holder                   | resolves; `meta.TransactionResult === 'tecLOCKED'`; fee charged                          |
| any tx with a stale `Sequence` (`tefPAST_SEQ`) | neither; polls until `LastLedgerSequence` passes, then throws `XrplError("The latest ledger sequence 42 is greater than the transaction's LastLedgerSequence (41).\nPreliminary result: tefPAST_SEQ")` |

The issuer project needs a regex over the error message to recover the code in the first and third
case (`tx.ts:52-75`, `engineResultFromError`, patterns `/Transaction failed, (te\w+):/` and
`/Preliminary result: (te\w+)/`), plus `requireMeta` for the second
([001](001-submitandwait-meta-string-undefined.md)). Every "expect this to fail with X" step in
`scenario.ts` goes through that helper.

## Expected vs actual

Expected: one place to look. Either `submitAndWait` resolves with a result object carrying the
engine code for every class (`tes`, `tec`, and the terminal-but-not-applied `tef`/`ter`/`tel`
cases), or it throws a typed error (`TransactionFailedError extends XrplError { engineResult:
string; engineResultMessage: string; phase: 'submit' | 'validation' }`) for everything that is not
`tesSUCCESS`, with the code as a property, not a substring.

Actual: the code is a string in `meta.TransactionResult` for `tec`, embedded in prose in
`error.message` for `tem`, and embedded in different prose after a timeout for the rest; `XrplError.data`
is `unknown` ([035](035-rippled-error-data-untyped.md)). Sample code that checks `result.meta` for
`tesSUCCESS` misses the timeout case; code that only catches misses `tec`. The captain's branch
adds `getTransactionResultCode(meta)` + `isTesSuccess(code)`, which fixes the `tec` half.

## Root cause

`submitAndWait` was layered on `submit` + `tx` polling without a unified outcome type.

## Proposed fix

Non-breaking addition, then (optionally) a breaking simplification:

```ts
// errors.ts
export class TransactionFailedError extends XrplError {
  constructor(public readonly engineResult: string,
              public readonly engineResultMessage: string | undefined,
              public readonly phase: 'submit' | 'validation' | 'expired',
              public readonly response?: SubmitResponse | TxResponse) { … }
}
```

- `submitAndWait`: throw `TransactionFailedError('tem…', msg, 'submit', response)` instead of a
  string-built `XrplError`; on expiry throw `TransactionFailedError(preliminary, undefined,
  'expired')`.
- Add `getTransactionResultCode` / `isTesSuccess` from the captain's branch, and
  `TransactionResult` narrowing: `type EngineResult = \`tes${string}\` | \`tec${string}\` | …`.
- Document on `submitAndWait` that `tec*` resolves normally and charges the fee.

## Workaround today

`audit/mpt-issuer/src/tx.ts` (`submitObserve`): scrape both messages with the regexes above and read
`meta.TransactionResult` on success.

## References

- `origin/add-transaction-result-helpers` (captain's prior art: `getTransactionResultCode`, `isTesSuccess`)
- xrpl.org "Transaction Results" (tes/tec/tef/tel/tem/ter classes)
- Related: [001](001-submitandwait-meta-string-undefined.md), [035](035-rippled-error-data-untyped.md)
