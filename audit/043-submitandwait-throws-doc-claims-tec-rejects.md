# `submitAndWait`'s `@throws` doc says a transaction that "cannot be included in a validated ledger" rejects the promise, including "insufficient balance"; `tec*` outcomes resolve normally

Severity: minor
Category: docs

## Affected surface

- `Client.submitAndWait` doc block — `packages/xrpl/src/client/index.ts:852-855`
- Behaviour — `client/index.ts:884-888` (only `tem*` throws), `packages/xrpl/src/sugar/submit.ts:154-158`
  (validated `tec*` returned as a normal `TxResponse`)

## Repro

Doc text (verbatim):

> @throws Transaction errors: If the submitted transaction is invalid or cannot be included in a
> validated ledger for any reason, the promise returned by `submitAndWait()` will be rejected with
> an error. This could include issues with insufficient balance, invalid transaction fields, or
> other issues specific to the transaction being submitted.

Observed (`audit/mpt-issuer` runs, rippled 3.4.0-rc1): `tecLOCKED`, `tecNO_AUTH`,
`tecINSUFFICIENT_FUNDS`, `tecPATH_PARTIAL`, `tecOBJECT_NOT_FOUND`, `tecNO_PERMISSION`,
`tecHAS_OBLIGATIONS` all **resolve** with `meta.TransactionResult` set and the fee charged; every
"expected failure" step in `scenario.ts` relies on reading the code from the resolved response.

## Expected vs actual

Expected: the doc says exactly what throws (`tem*` at submission; expiry past `LastLedgerSequence`)
and that `tec*` — including insufficient balance — is a *successful* call whose result must be
inspected.

Actual: a developer following the doc wraps `submitAndWait` in `try/catch`, treats a resolved
promise as "delivered", and ships a compliance flow where a `tecLOCKED` payment is logged as a
success. This is the documentation half of
[025](025-submitandwait-three-failure-surfaces-no-result-helper.md).

## Root cause

The `@throws` block was written aspirationally; the implementation only checks `startsWith('tem')`.

## Proposed fix

Docs only:

```ts
 * @throws XrplError if the preliminary submit result is `tem*`, or if `LastLedgerSequence` passes
 *   before the transaction is validated (message contains "Preliminary result: <code>").
 * @remarks A transaction validated with a `tec*` result (e.g. `tecNO_AUTH`, `tecLOCKED`,
 *   `tecINSUFFICIENT_FUNDS`) does NOT reject: it resolves normally, the fee is charged, and the
 *   outcome is `result.meta.TransactionResult`. Check it (see `isTesSuccess`).
```

## Workaround today

Always read `meta.TransactionResult`; see `audit/mpt-issuer/src/tx.ts` (`submitOk`).

## References

- Related: [025](025-submitandwait-three-failure-surfaces-no-result-helper.md), [001](001-submitandwait-meta-string-undefined.md)
