# `Client.simulate` does not thread the transaction type through, so `result.tx_json` and `result.meta` are the full union; it also skips autofill normalisation (`DeliverMax`)

Severity: minor
Category: types

## Affected surface

- `Client.simulate<Binary extends boolean = false>(transaction: SubmittableTransaction | string, …)`
  — `packages/xrpl/src/client/index.ts:738-754`
- `SimulateJsonResponse<T extends BaseTransaction = Transaction>` — `packages/xrpl/src/models/methods/simulate.ts:67-89`
- `RequestResponseMap` `SimulateJsonRequest ? SimulateJsonResponse` — `methods/index.ts:436-441`
  (no type argument)

## Repro

```ts
const res = await client.simulate(setTx)              // setTx: MPTokenIssuanceSet
res.result.tx_json.MPTokenIssuanceID
// TS2339: Property 'MPTokenIssuanceID' does not exist on type 'Transaction' (union)
```

Compiled repro `repros.ts` (`audit030`). Hit in `audit/mpt-issuer/src/check-amendments.ts:86-90`
and `probes.ts:47-54`, which only read `engine_result` for that reason.

Second half (`npm run probes`, last row):

```
Payment: DeliverMax (RPC-only alias) with MPT | validate: ok | rippled: RippledError: Field 'tx_json.DeliverMax' is unknown.
```

The same transaction passed to `submitAndWait` succeeds, because `autofill` rewrites `DeliverMax`
into `Amount` (`sugar/autofill.ts:585-600`) and `simulate` never calls `autofill`.

## Expected vs actual

Expected: `simulate<T extends SubmittableTransaction>(tx: T)` returns `SimulateJsonResponse<T>`
(the response type already has the parameter; the client just never supplies it), and simulating a
transaction the SDK would happily submit gives rippled's verdict on *that* transaction, not on an
un-normalised one.

Actual: `T` defaults to `Transaction`; `meta` is `TransactionMetadata<Transaction>`; and `simulate`
sends the object as-is, so SDK-level conveniences (`DeliverMax`, flag interfaces → `convertTxFlagsToNumber`
is applied by `validate` in `sign`, not here) do not apply. `Flags: { tfMPTLock: true }` in object
form is rejected by rippled in `simulate` (`RippledError: Field 'tx_json.Flags' has bad type.`,
verified) while the same object works in `submitAndWait`.

## Root cause

`simulate` was added as a thin request wrapper.

## Proposed fix

Non-breaking:

```ts
public async simulate<T extends SubmittableTransaction, Binary extends boolean = false>(
  transaction: T | string, opts?: { binary?: Binary; autofill?: boolean },
): Promise<Binary extends true ? SimulateBinaryResponse : SimulateJsonResponse<T>> {
  const tx = typeof transaction === 'string' ? transaction
           : opts?.autofill === false ? transaction : await this.autofill(transaction) // Sequence/Fee are optional for simulate; at least normalise Flags + DeliverMax
  …
}
```

At minimum run `convertTxFlagsToNumber` and `handleDeliverMax` before sending.

## Workaround today

`client.simulate<…>` cannot take a type argument today; cast `res.result.tx_json as
MPTokenIssuanceSet`. Normalise flags/`DeliverMax` yourself before simulating.

## References

- Related: [001](001-submitandwait-meta-string-undefined.md), [042](042-handledelivermax-compares-object-amounts-by-reference.md)
