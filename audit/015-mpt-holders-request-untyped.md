# The Clio-only `mpt_holders` method has no request/response type, and the SDK does not say that rippled cannot enumerate holders at all

Severity: minor
Category: rpc

## Affected surface

- `Request` union — `packages/xrpl/src/models/methods/index.ts:208-262` (has the Clio-only
  `NFTInfoRequest`, `NFTHistoryRequest`, `NFTsByIssuerRequest`; no `MPTHoldersRequest`)
- `grep -rn mpt_holders packages/xrpl/src` → no matches

## Repro

```ts
await client.request({ command: 'mpt_holders', mpt_issuance_id: issuanceId })
// TS2353: Object literal may only specify known properties, and 'mpt_issuance_id' does not exist in type 'Request'
```

Compiled repro `repros.ts` (`audit015and026`). The issuer project goes through
`client.connection.request` with an untyped payload (`audit/mpt-issuer/src/inspect.ts:140-156`,
`tryMptHolders`). Against rippled 3.4.0-rc1 the answer is `Unknown method.` (scenario step
"inspect: mpt_holders is not served by rippled").

## Expected vs actual

Expected: either a typed `MPTHoldersRequest`/`MPTHoldersResponse` (documented as Clio-only, like
the `nft_*` Clio methods already in the union), or at least a doc note on `MPTokenIssuance` /
`account_objects` explaining that rippled offers **no** way to list the holders of an issuance —
the issuer must keep its own registry (which is exactly what `audit/mpt-issuer/src/ban.ts` has to do
for lock-on-arrival sweeps).

Actual: the method is absent from the types; the limitation is undocumented; an issuer who needs
"lock every holder I have banned" discovers the gap in production.

## Root cause

Clio's MPT methods were not mirrored when the NFT Clio methods were.

## Proposed fix

Non-breaking addition:

```ts
// models/methods/mptHolders.ts  (Clio only)
export interface MPTHoldersRequest extends BaseRequest, LookupByLedgerRequest {
  command: 'mpt_holders'
  mpt_issuance_id: string
  limit?: number
  marker?: unknown
}
export interface MPTHoldersResponse extends BaseResponse {
  result: {
    mpt_issuance_id: string
    mptokens: Array<{
      account: string
      flags: number
      mpt_amount: string
      locked_amount?: string
      mptoken_index: string
    }>
    ledger_index: number
    validated: boolean
    limit?: number
    marker?: string
  }
}
```

plus the two lines in `Request`/`Response` unions and `RequestResponseMap`, and a `@remarks` on
`MPTokenIssuance` that holder enumeration requires Clio.

## Workaround today

`client.connection.request({ command: 'mpt_holders', … })` against a Clio endpoint, cast the
result; keep an off-ledger holder registry when talking to rippled.

## References

- Clio `mpt_holders` documentation (xrpl.org "mpt_holders")
- Related: [026](026-admin-commands-not-in-request-union.md), [028](028-pre-emptive-ban-not-expressible-on-ledger.md)
