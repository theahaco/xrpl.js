# `Payment.Amount` is required, but every API-v2 read-back (`submitAndWait`, `tx`, `account_tx`, streams) returns `DeliverMax` and no `Amount`

Severity: minor
Category: types

## Affected surface

- `Payment.Amount: Amount | MPTAmount` (required) — `packages/xrpl/src/models/transactions/payment.ts:133`;
  `DeliverMax?` — `:135`
- Consumers of `tx_json: T`: `TxResponse` — `models/methods/tx.ts:96-100`; `AccountTxTransaction`
  — `accountTx.ts:69-71`; `TransactionStream` — `subscribe.ts:325-327`

## Repro

Live (rippled 3.4.0-rc1, `audit/README.md` round-2 log): a validated MPT `Payment` read back through
`submitAndWait`:

```
tx_json.Amount     = undefined
tx_json.DeliverMax = { "mpt_issuance_id": "000002A4…", "value": "10" }
```

The repo's own fixture agrees: `packages/xrpl/test/fixtures/rippled/tx/payment.json` has
`tx_json.DeliverMax` and no `Amount`.

```ts
const res = await client.submitAndWait(payment, { wallet })
const sent = res.result.tx_json.Amount   // typed Amount | MPTAmount; undefined at runtime
```

## Expected vs actual

Expected: the read-side type reflects API v2 (`DeliverMax` present, `Amount` absent for
Payments), or the SDK normalises `DeliverMax` back to `Amount` on the way in, as it normalises
`Amount` → `DeliverMax` on the way out (`sugar/autofill.ts:585-600`).

Actual: one `Payment` interface serves both directions; on the submit side `Amount` is required and
`DeliverMax` is stripped ([042](042-handledelivermax-compares-object-amounts-by-reference.md)); on
the read side the reverse is true and the type lies. Reading "how much did this payment ask to
deliver?" from any v2 response is `undefined` per the runtime and `Amount | MPTAmount` per the type.

## Root cause

API v2's `DeliverMax` rename was handled in `autofill` only.

## Proposed fix

Non-breaking option: in `handlePartialPayment`/response post-processing, set
`tx_json.Amount ??= tx_json.DeliverMax` for Payments. Type-level option (breaking): split
`Payment` into the submit shape (`Amount` required, no `DeliverMax`) and a `PaymentV2` read shape
(`DeliverMax` required), and use the latter in `TxResponse`/`AccountTxTransaction`/streams.

## Workaround today

`(tx_json as Payment).DeliverMax ?? tx_json.Amount`.

## References

- xrpl.org "API v2 changes: `DeliverMax`"
- Related: [042](042-handledelivermax-compares-object-amounts-by-reference.md), [017](017-amount-type-excludes-mptamount.md)
