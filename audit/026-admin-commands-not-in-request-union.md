# Admin-only commands (`ledger_accept`, `feature` with `vetoed`, `log_level`, …) are absent from the `Request` union, so standalone-ledger tooling has to bypass `Client.request`

Severity: minor
Category: rpc

## Affected surface

- `Request` union — `packages/xrpl/src/models/methods/index.ts:208-262`
- `Client.request<R extends Request>` — `packages/xrpl/src/client/index.ts:355-372`
- The repo's own workaround: `packages/xrpl/test/integration/utils.ts:33-35`
  (`client.connection.request({ command: 'ledger_accept' })`)

## Repro

```ts
await client.request({ command: 'ledger_accept' })
// TS2322: Type '"ledger_accept"' is not assignable to type '"account_channels" | … | "vault_info"'.
```

Compiled repro `repros.ts` (`audit015and026`). The issuer project's ledger closer
(`audit/mpt-issuer/src/session.ts:46-55`) uses `client.connection.request`, a semi-internal API
whose result type is `unknown`.

## Expected vs actual

Expected: either the admin commands needed for test harnesses (`ledger_accept` at minimum; it is
what every standalone test in this repo depends on) are typed, or `Client.request` has a documented
escape hatch (`request<R extends BaseRequest>(req: R): Promise<BaseResponse>` overload) so callers
do not reach into `connection`.

Actual: `Request` is closed; unknown commands are a compile error; the only typed way out is a cast
to `Request`, which then produces a wrong response type.

## Root cause

The union doubles as "commands we know" and "commands you may send".

## Proposed fix

Non-breaking:

```ts
// models/methods/ledgerAccept.ts
export interface LedgerAcceptRequest extends BaseRequest { command: 'ledger_accept' }
export interface LedgerAcceptResponse extends BaseResponse { result: { ledger_current_index: number } }
```

added to the unions (marked `@remarks admin-only; standalone mode`), plus a generic fallback
overload on `Client.request`:

```ts
public async request<R extends BaseRequest>(req: R & { command: Exclude<string, Request['command']> }): Promise<BaseResponse>
```

## Workaround today

`client.connection.request({ command: 'ledger_accept' })`.

## References

- `packages/xrpl/test/integration/utils.ts:33-35`
- Related: [015](015-mpt-holders-request-untyped.md)
