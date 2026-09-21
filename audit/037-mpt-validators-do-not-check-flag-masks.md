# None of the MPT validators (nor `Clawback`) reject flag bits outside the transaction's mask; rippled answers `temINVALID_FLAG`

Severity: minor
Category: validation

## Affected surface

- `validateMPTokenIssuanceCreate` — `packages/xrpl/src/models/transactions/MPTokenIssuanceCreate.ts:283-391`
- `validateMPTokenIssuanceSet` — `MPTokenIssuanceSet.ts:190-338` (uses
  `tfMPTokenIssuanceSetEnableFlagMask` only to detect "is a mutation", never to reject unknown bits)
- `validateMPTokenAuthorize` — `MPTokenAuthorize.ts:63-67`
- `validateClawback` — `clawback.ts:45-69`
- `validateBaseTransaction` — `common.ts:964-` (only knows `GlobalFlags`)

## Repro

`npm run probes` (rippled 3.4.0-rc1):

```
Authorize: unknown flag bit 0x2       | validate: ok | rippled: temINVALID_FLAG
Set: unknown flag bit 0x8000          | validate: ok | rippled: temINVALID_FLAG
Create: Flags 0x1 (lsfMPTLocked bit)  | validate: ok | rippled: temINVALID_FLAG
Clawback: unknown flag bit 0x1        | validate: ok | rippled: temINVALID_FLAG
```

The `Create: Flags 0x1` case is the realistic one: `0x1` is `lsfMPTLocked` on the ledger object, and
a developer who reads the issuance's `Flags` back and re-submits them (or confuses `lsf`/`tf`
enums, both exported) gets a rejected transaction and an `XrplError` with the code in prose
([025](025-submitandwait-three-failure-surfaces-no-result-helper.md)).

## Expected vs actual

Expected: each validator computes `convertTxFlagsToNumber(tx)` and rejects
`(flags & ~allowedMask) !== 0` with `ValidationError('<Type>: invalid Flags')`, where the masks
are the ones rippled uses (`tfMPTokenIssuanceCreateMask`, `tfMPTokenIssuanceSetMask`,
`tfMPTokenAuthorizeMask`, `tfClawbackMask` = universal flags only). The interface form already
rejects unknown *names* (`convertTxFlagsToNumber` throws `Invalid flag`), so only the numeric form
is unchecked.

Actual: numeric `Flags` are passed through; the SDK exports the enums but not the masks.

## Root cause

Mask constants were never added alongside the enums.

## Proposed fix

Non-breaking:

```ts
// per transaction file
export const tfMPTokenIssuanceCreateMask = ~(tfMPTCanLock | tfMPTRequireAuth | tfMPTCanEscrow | tfMPTCanTrade | tfMPTCanTransfer | tfMPTCanClawback | tfMPTCanHoldConfidentialBalance | GlobalFlags.tfFullyCanonicalSig /* + inner batch bit */)
export const tfMPTokenIssuanceSetMask   = ~(tfMPTLock | tfMPTUnlock | tfMPTokenIssuanceSetEnableFlagMask | …)
export const tfMPTokenAuthorizeMask     = ~(tfMPTUnauthorize | …)
// in each validator
if ((convertTxFlagsToNumber(tx) & tfXxxMask) !== 0) throw new ValidationError('Xxx: invalid Flags')
```

and a shared `validateFlagsMask(tx, mask, txName)` in `common.ts`.

## Workaround today

Build flags from the interface form (`Flags: { tfMPTLock: true }`), which is name-checked.

## References

- rippled `TxFlags.h` (`tfMPTokenIssuanceCreateMask`, `tfMPTokenIssuanceSetMask`, `tfMPTokenAuthorizeMask`)
- Related: [014](014-validatemptokenauthorize-enforces-nothing.md)
