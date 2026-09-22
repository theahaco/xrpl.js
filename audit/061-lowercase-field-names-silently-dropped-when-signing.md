# A lowercase (or otherwise unknown lowercase-initial) field is silently dropped when signing; `MPTokenIssuanceSet { Flags: tfMPTLock, holder }` is submitted as a global freeze

Severity: blocker
Category: runtime

## Affected surface

- `STObject.from` — `packages/ripple-binary-codec/src/types/st-object.ts:129-136`
  (`if (!(f in definitions.field)) { if (f[0] === f[0].toLowerCase()) return undefined; throw … }`)
- `validateBaseTransaction` — `packages/xrpl/src/models/transactions/common.ts:964-1035` (no unknown-key check)
- `Wallet.sign` — `packages/xrpl/src/Wallet/index.ts:403-441` (no encode/decode round-trip; the
  serialisation check was removed in #2293)
- Enabled at the type level by [004](004-basetransaction-record-string-unknown-collapses-keyof.md)

## Repro

Offline against the built package (`audit/README.md` round-2 log, verbatim):

```
validate(Set with lowercase holder)                   -> ok
sign(Set with lowercase holder) -> decoded Holder     -> undefined
sign(Create with assetScale:2) -> decoded AssetScale  -> undefined
sign(Set with MPTokenHolder typo)                     -> throws Error: Field MPTokenHolder is not defined in the definitions
```

```ts
const tx: MPTokenIssuanceSet = {
  TransactionType: 'MPTokenIssuanceSet', Account: issuer, MPTokenIssuanceID: id,
  Flags: MPTokenIssuanceSetFlags.tfMPTLock,
  holder: bannedAddress,          // compiles (004), passes validate(), is dropped by encode()
}
await client.submitAndWait(tx, { wallet })   // tesSUCCESS: every holder is now locked
```

## Expected vs actual

Expected: an unknown key is rejected before signing with a `ValidationError` naming it, or the
codec throws for every unknown field the way it does for capitalised ones.

Actual: the codec's convenience rule "lowercase-initial keys are client-side extras, skip them" turns
a one-character casing mistake into a **different transaction**. For the audit's ban flow the
difference is per-holder lock vs. issuance-wide freeze of all holders; for
`MPTokenIssuanceCreate` it is losing `AssetScale`/`MaximumAmount` on an immutable object. No layer
reports anything; the transaction succeeds.

Round-3 extension (sweep g): the same outcome through a different door —
`{ TransactionType: 'MPTokenIssuanceSet', Flags: tfMPTLock, Holder: registry.get(addr) }` with a
missing registry entry yields `Holder: undefined`, which the codec omits (standard JSON semantics;
verified: the signed transaction has no `Holder`), i.e. again a global freeze. The "reject unknown
keys" fix below does not cover it; the issuer-side guard is `if (holder === undefined) throw` before
building the transaction, or a builder that takes `holder: string` (the issuer project's
`holderLockTx` does).

## Root cause

Three layers each assume another one checks: the types (index signature), `validate()` (no
allow-list of keys per transaction), and the codec (deliberate skip). The round-trip check that
would have caught the discrepancy (`checkTxSerialization`) was deleted in 2023.

## Proposed fix

Non-breaking (rejects input that was never sent correctly):

```ts
// common.ts, called from validateBaseTransaction
export function validateNoUnknownFields(tx: Record<string, unknown>, txType: string): void {
  for (const key of Object.keys(tx)) {
    if (!(key in definitions.field) && !SDK_ONLY_FIELDS.has(key)) {   // definitions from ripple-binary-codec
      throw new ValidationError(`${txType}: unknown field "${key}"${suggest(key)}`)
    }
  }
}
```

where `SDK_ONLY_FIELDS` is the small set the SDK itself adds and strips (`DeliverMax`,
`ctid`-style helpers). Additionally, restore a cheap round-trip in `Wallet.sign`:
`decode(tx_blob)` must contain every capitalised key of the input.

## Workaround today

Enable the compiler: use the `Strict<T>` mapped type from
[004](004-basetransaction-record-string-unknown-collapses-keyof.md) or build transactions through a
factory ([003](003-transaction-literals-widen-no-factory.md)) so `holder` is a compile error.

## References

- `packages/ripple-binary-codec/src/types/st-object.ts:129-136`
- Related: [004](004-basetransaction-record-string-unknown-collapses-keyof.md), [022](022-binary-codec-silently-truncates-mpt-values-above-2-64.md)
