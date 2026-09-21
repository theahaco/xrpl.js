# `Client.request` never infers its `V` type parameter from `api_version`, and `client.apiVersion` is a public mutable field with no type-level counterpart, so v1 responses are typed as v2

Severity: minor
Category: types

## Affected surface

- `Client.request<R extends Request, V extends APIVersion = typeof DEFAULT_API_VERSION, T = RequestResponseMap<R, V>>(req: R)` — `packages/xrpl/src/client/index.ts:355-372`
  (`V` is only a default; `api_version: req.api_version ?? this.apiVersion` at `:366`)
- `Client.apiVersion` — `client/index.ts:232`
- `RequestAllResponseMap`, `RequestNextPageReturnMap` — `models/methods/index.ts:509-526`, `client/index.ts:132-144`
- The repo's own tests must spell it: `client.request<TxRequest, 1>({ …, api_version: 1 })`
  (`test/integration/requests/tx.test.ts:96-100`, `accountTx.test.ts:126-128`)

## Repro

Compiled (`audit/README.md` round-2 log):

```ts
const r = await client.request({ command: 'tx', transaction: hash, api_version: 1 })
const acct: string = r.result.Account   // TS2339 — typed as v2 (tx_json), but under v1 the fields ARE at result top level
const tj = r.result.tx_json             // compiles; undefined at runtime under api_version 1
```

Setting `client.apiVersion = 1` compiles and then every `submitAndWait` still promises
`TxResponse<T>` with `tx_json`.

## Expected vs actual

Expected: `RequestResponseMap<R, R extends { api_version: 1 } ? 1 : 2>`, so the literal decides the
shape; `apiVersion` either readonly-at-construction (generic on `Client`) or documented as
"changes runtime shape, not types".

Actual: v1 users (the explicit opt-in path for older Clio/rippled deployments) read
`meta.mpt_issuance_id` / `tx_json.MPTokenIssuanceID` from a shape that does not exist at runtime,
behind green types.

## Root cause

`V` was added as a manual parameter and never connected to the request.

## Proposed fix

Non-breaking (default stays v2):

```ts
type VersionOf<R> = R extends { api_version: infer V extends APIVersion } ? V : typeof DEFAULT_API_VERSION
public async request<R extends Request>(req: R): Promise<RequestResponseMap<R, VersionOf<R>>>
```

## Workaround today

`client.request<TxRequest, 1>(…)` as the tests do.

## References

- Related: [001](001-submitandwait-meta-string-undefined.md), [030](030-simulate-does-not-thread-transaction-type.md)
