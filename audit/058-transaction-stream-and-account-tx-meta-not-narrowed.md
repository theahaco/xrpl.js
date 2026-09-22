# `transaction` stream events and `account_tx` rows never narrow `meta` to the transaction in `tx_json`; `meta.mpt_issuance_id` is unreachable on the push path

Severity: minor
Category: types

## Affected surface

- `TransactionStreamBase.meta?: TransactionMetadata` — `packages/xrpl/src/models/methods/subscribe.ts:323`;
  `tx_json?` — `:325-328`; `OnEventToListenerMap['transaction']` — `:514-515`
- `AccountTxTransaction.meta` — `packages/xrpl/src/models/methods/accountTx.ts:67`; `tx_json` — `:69-71`
- `TransactionMetadata<T = Transaction>` distributes — `models/transactions/metadata.ts:95-108`

## Repro

```ts
client.on('transaction', (ev) => {
  if (ev.tx_json?.TransactionType === 'MPTokenIssuanceCreate') {
    ev.meta?.mpt_issuance_id
    // TS2339: Property 'mpt_issuance_id' does not exist on type 'TransactionMetadata'.
    //   Property 'mpt_issuance_id' does not exist on type 'TransactionMetadataBase'.
  }
})
```

(Compiled, `audit/README.md` round-2 log; same for `account_tx` rows.) rippled injects
`mpt_issuance_id` into stream `meta` for `MPTokenIssuanceCreate` exactly as it does for `tx`, so the
value is there at runtime.

## Expected vs actual

Expected: `meta` and `tx_json` are correlated — `{ tx_json: T; meta?: TransactionMetadata<T> }`
distributed over `T`, so narrowing `tx_json.TransactionType` narrows `meta`.

Actual: two independent optional properties; `meta` is the union of every metadata shape. The
`transaction` stream is the only push-based way to learn the ID of an issuance you did not submit
yourself (and to watch banned addresses opt in, [028](028-pre-emptive-ban-not-expressible-on-ledger.md)),
and it needs `'mpt_issuance_id' in ev.meta` to read it.

## Root cause

Stream and history types were written before `TransactionMetadata<T>` became conditional.

## Proposed fix

Type-only, non-breaking:

```ts
type TxWithMeta<T extends Transaction = Transaction> = T extends unknown
  ? { tx_json?: T & ResponseOnlyTxInfo; meta?: TransactionMetadata<T> }
  : never
export interface TransactionStreamBase { … } & TxWithMeta   // and AccountTxTransaction
```

## Workaround today

`if (ev.meta && 'mpt_issuance_id' in ev.meta) …`, or `ev.meta as MPTokenIssuanceCreateMetadata`.

## References

- Related: [002](002-wallet-sign-erases-transaction-type.md), [012](012-no-helper-to-derive-mpt-issuance-id-or-keylets.md)
