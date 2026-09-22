# `RippledError.data` is `unknown`, so telling `entryNotFound` apart from any other `ledger_entry` failure needs a hand-written structural guard

Severity: minor
Category: types

## Affected surface

- `XrplError.data?: unknown` — `packages/xrpl/src/errors.ts:8-20`; `RippledError extends XrplError` — `errors.ts:62`
- `RequestManager.handleResponse` (constructs `RippledError(error_message, response)`) —
  `packages/xrpl/src/client/RequestManager.ts:~198`

## Repro

The issuer project's first `ban` run crashed with (trimmed):

```
RippledError: Entry not found.
  data: {
    error: 'entryNotFound', error_code: 98, error_message: 'Entry not found.',
    index: 'F258E5…', ledger_hash: '5274…', ledger_index: 129,
    request: { command: 'ledger_entry', mptoken: [Object], … }, status: 'error', type: 'response', validated: true
  }
```

because the not-found check matched on `err.message` (`"Entry not found."`) instead of
`err.data.error`. The fix (`audit/mpt-issuer/src/inspect.ts:56-74`) is:

```ts
if (!(err instanceof RippledError)) return false
const data: unknown = err.data
return typeof data === 'object' && data !== null && 'error' in data &&
  (data.error === 'entryNotFound' || data.error === 'objectNotFound')
```

## Expected vs actual

Expected: `RippledError` carries the rippled error response in a typed field
(`error: string; error_code?: number; error_message?: string; request: BaseRequest; status: 'error'`),
and ideally a string-literal union of the common codes (`'entryNotFound' | 'actNotFound' |
'txnNotFound' | 'invalidParams' | …`), so `catch (e) { if (e instanceof RippledError &&
e.data.error === 'entryNotFound') … }` type-checks.

Actual: `data` is `unknown`; the message is prose that differs from the code; the SDK's own
`waitForFinalTransactionOutcome` does the same unsafe dance
(`sugar/submit.ts:135-152`: `const message = error?.data?.error as string`, with an eslint-disable).
"Does this holder have an MPToken?" — the primitive every allow-list/ban sweep needs — is therefore
an untyped exception path today.

## Root cause

`XrplError` is a generic carrier; `RippledError` never specialised it.

## Proposed fix

Non-breaking (narrowing `unknown` to a structural type on a subclass):

```ts
export interface RippledErrorResponse {
  error: string
  error_code?: number
  error_message?: string
  error_exception?: string
  request?: BaseRequest
  status: 'error'
  type: 'response'
  [extra: string]: unknown
}
class RippledError extends XrplError {
  public declare readonly data?: RippledErrorResponse
  get code(): string | undefined { return this.data?.error }
}
```

plus a sugar `client.getLedgerEntry(req)` / `client.getMPToken(issuanceId, account)` returning
`undefined` on `entryNotFound`.

## Workaround today

The structural guard above.

## References

- xrpl.org "Error Formatting" (universal error fields), `ledger_entry` possible errors
- Related: [025](025-submitandwait-three-failure-surfaces-no-result-helper.md), [028](028-pre-emptive-ban-not-expressible-on-ledger.md)
