# `Wallet.sign()` is not generic, so a signed blob loses its transaction type and `submitAndWait(blob)` degrades to the 70-member union

Severity: major
Category: types

## Affected surface

- `Wallet.sign` — `packages/xrpl/src/Wallet/index.ts:375-382` (`sign(transaction: Transaction, multisign?): { tx_blob: string; hash: string }`)
- `Client.submitAndWait` — `packages/xrpl/src/client/index.ts:862-874` (`transaction: T | string`)
- `getSignedTx` — `packages/xrpl/src/sugar/submit.ts:225-259` (returns `SubmittableTransaction | string`)

## Repro

```ts
const { tx_blob } = wallet.sign(createTx)          // tx_blob: string — MPTokenIssuanceCreate is gone
const res = await client.submitAndWait(tx_blob)    // T falls back to SubmittableTransaction
const meta = res.result.meta
if (typeof meta === 'object') {
  meta.mpt_issuance_id
  // TS2339: Property 'mpt_issuance_id' does not exist on type
  //   'TransactionMetadataBase | PaymentMetadata | NFTokenMintMetadata | ...'
}
```

Compiled repro: `audit/mpt-issuer/src/type-repros/repros.ts` (`audit002`). The issuer project avoids the
problem by never calling `sign()` itself (`audit/mpt-issuer/src/tx.ts:38-46` passes the typed
object and lets the sugar sign), which is the only way to keep `T`.

## Expected vs actual

Expected: signing a `MPTokenIssuanceCreate` yields something that still "is" a
`MPTokenIssuanceCreate` for the purposes of `submitAndWait`, so `res.result.meta` is
`MPTokenIssuanceCreateMetadata` and `tx_json` is `MPTokenIssuanceCreate`.

Actual: `tx_blob` is a bare `string`. `submitAndWait(tx_blob)` infers `T = SubmittableTransaction`,
so `meta` distributes over `TransactionMetadata<SubmittableTransaction>` into a union of every
special-cased metadata shape and `tx_json` is the full union. The documented way to get the type back
is `submitAndWait<MPTokenIssuanceCreate>(tx_blob)`, an unchecked assertion of intent that the compiler
cannot verify against the blob.

## Root cause

`sign()` accepts `Transaction` and returns `{ tx_blob: string; hash: string }` with no type parameter;
nothing carries the input type across the serialisation boundary.

## Proposed fix

Non-breaking, type-only. Phantom-type the blob:

```ts
// Wallet/index.ts
export type SignedBlob<T extends Transaction = Transaction> = string & { readonly __xrplTx?: T }

public sign<T extends Transaction>(transaction: T, multisign?: boolean | string):
  { tx_blob: SignedBlob<T>; hash: string }
```

```ts
// client/index.ts
public async submitAndWait<T extends SubmittableTransaction = SubmittableTransaction>(
  transaction: T | SignedBlob<T> | string, opts?: ...): Promise<TxResponse<T>>
```

`SignedBlob<T>` is assignable to `string` (it *is* a string at runtime; the brand is an optional
phantom property that is never populated), so existing code that treats `tx_blob` as a string keeps
compiling, and `encode`/`submit` are unaffected. Inference picks `T` from the brand when a
`SignedBlob<T>` is passed, and still falls back to the union for a plain `string`.

## Workaround today

- Pass the typed object to `submitAndWait(tx, { wallet })` and let it sign.
- Or supply the type argument explicitly: `submitAndWait<MPTokenIssuanceCreate>(tx_blob)`.

## References

- `packages/xrpl/src/sugar/submit.ts:248-258` (`getSignedTx` returns `wallet.sign(tx).tx_blob`)
- `packages/xrpl/src/models/transactions/metadata.ts:95-108` (`TransactionMetadata<T>` distributes)
- Captain's seed document (`issues.md`, "`submitAndWait` issue", root cause 1)
- Related: [001](001-submitandwait-meta-string-undefined.md)
