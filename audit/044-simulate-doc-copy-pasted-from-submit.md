# `Client.simulate`'s doc block is copied from `submit` and claims it autofills, signs and submits; it does none of those

Severity: minor
Category: docs

## Affected surface

- `Client.simulate` doc — `packages/xrpl/src/client/index.ts:721-737`
- Implementation — `client/index.ts:738-755` (builds `{ command: 'simulate', tx_json | tx_blob, binary }` and calls `this.request`)

## Repro

Doc text (verbatim):

> Simulates an unsigned transaction. Steps performed on a transaction: 1. Autofill. 2. Sign &
> Encode. 3. Submit. … @param transaction - A transaction to autofill, sign & encode, and submit.
> @param opts - (Optional) Options used to sign and submit a transaction.

Observed (`npm run probes`, and the flag probe in `audit/README.md` round-2 log): the object is sent
as-is. `Flags: { tfMPTLock: true }` → `RippledError: Field 'tx_json.Flags' has bad type.`;
`DeliverMax` present → `RippledError: Field 'tx_json.DeliverMax' is unknown.`. rippled also rejects a
*signed* transaction in `simulate`, so a developer who signs first "because step 2 signs anyway" gets
an error.

## Expected vs actual

Expected: "Dry-runs the transaction via rippled's `simulate` RPC against the current open ledger.
Nothing is autofilled, signed, or submitted: `Flags` must be numeric, `DeliverMax` must not be
present, `Sequence`/`Fee` may be omitted (rippled fills them), and the transaction must be unsigned."

Actual: the block describes `submit`. Together with [030](030-simulate-does-not-thread-transaction-type.md)
(no normalisation, no `T`), `simulate` is the least trustworthy entry point on the client while its
doc promises the most.

## Root cause

Copy-paste when `simulate` was added.

## Proposed fix

Docs only; replace the block with the text above. Ideally also do the normalisation
([030](030-simulate-does-not-thread-transaction-type.md)) so the doc could truthfully say "Flags may be
given in either form".

## Workaround today

Read `client/index.ts:738-755`.

## References

- Related: [030](030-simulate-does-not-thread-transaction-type.md)
