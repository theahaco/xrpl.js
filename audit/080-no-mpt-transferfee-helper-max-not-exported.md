# No helper converts a percentage to an MPT `TransferFee`; the exported `percentToTransferRate` yields billionths that the MPT validator rejects, and `MAX_TRANSFER_FEE` is not exported

Severity: minor
Category: missing-helper

## Affected surface

- `percentToTransferRate` / `decimalToTransferRate` — `packages/xrpl/src/utils/quality.ts:36-72`
  (IOU `TransferRate`: 1,000,000,000 = 0%)
- `MAX_TRANSFER_FEE = 50000` — `packages/xrpl/src/models/transactions/MPTokenIssuanceCreate.ts:22`
  (not in `models/transactions/index.ts` re-exports; `import { MAX_TRANSFER_FEE } from 'xrpl'` →
  TS2305)
- `MPTokenIssuanceCreate.TransferFee` docs — `MPTokenIssuanceCreate.ts:238-244` ("0 and 50,000 …
  increments of 0.001")

## Repro

Offline (`audit/README.md` round-2 log):

```
percentToTransferRate('1%')  -> 1010000000
validate({ MPTokenIssuanceCreate, TransferFee: 1010000000 }) -> ValidationError: MPTokenIssuanceCreate: TransferFee must be between 0 and 50000
import { MAX_TRANSFER_FEE } from 'xrpl'  -> TS2305: Module '"xrpl"' has no exported member 'MAX_TRANSFER_FEE'.
```

## Expected vs actual

Expected: `percentToMPTTransferFee('1%') === 1000` / `mptTransferFeeToPercent(1000) === '1%'`
(units of 0.001%, 50,000 = 50%), mirroring the IOU pair, plus the bound exported next to the
enums so callers can clamp.

Actual: the only fee helpers in the package are for the other unit; the validator catches the
mistake (so not silent), but every issuer hand-derives `basisPoints * 10`. The same unit also
appears on `MPTokenIssuanceSet.TransferFee` and the ledger's `MPTokenIssuance.TransferFee`, and
the read side (`transferRateToDecimal`) has no MPT counterpart either.

## Root cause

MPT transfer fees use a new unit and got no conversion helpers.

## Proposed fix

Non-breaking additions:

```ts
// utils/quality.ts
export const MAX_MPT_TRANSFER_FEE = 50_000
export function percentToMPTTransferFee(percent: string): number   // '1%' -> 1000; throws outside 0..50%
export function mptTransferFeeToPercent(fee: number): string        // 1000 -> '1%'
// models/transactions/index.ts: export { MAX_TRANSFER_FEE }
```

## Workaround today

`Math.round(percent * 1000)`.

## References

- XLS-33 §TransferFee (0.001% units, max 50,000)
- Related: [016](016-mpt-amount-value-not-validated-no-scale-helper.md), [049](049-mptokenissuancecreate-transferfee-maximumamount-docs-wrong.md)
