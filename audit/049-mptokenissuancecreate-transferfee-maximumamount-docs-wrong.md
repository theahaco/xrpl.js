# `MPTokenIssuanceCreate` docs misstate `TransferFee` ("must NOT be present" without `tfMPTCanTransfer`) and `MaximumAmount` ("non-negative"); the validator and rippled disagree with both

Severity: paper-cut
Category: docs

## Affected surface

- `TransferFee` doc — `packages/xrpl/src/models/transactions/MPTokenIssuanceCreate.ts:238-244`
- `MaximumAmount` doc — `MPTokenIssuanceCreate.ts:228-237`
- Validator — `MPTokenIssuanceCreate.ts:328-338` (`MaximumAmount <= 0` rejected), `:363-375`
  (`if (tx.TransferFee && !isTfMPTCanTransfer)`; non-zero fee + `tfMPTCanHoldConfidentialBalance` rejected)

## Repro

Doc (verbatim): "The field must NOT be present if the `tfMPTCanTransfer` flag is not set." and
"It is a non-negative integer string that can store a range of up to 63 bits."

`npm run probes` (rippled 3.4.0-rc1):

```
Create: TransferFee 0 without CanTransfer | validate: ok                                                  | rippled: tesSUCCESS
Create: MaximumAmount "0"                 | validate: ValidationError: MPTokenIssuanceCreate: MaximumAmount out of range | rippled: temMALFORMED
Create: TransferFee 0 + tfMPTCanHoldConfidentialBalance                                                   | rippled: tesSUCCESS
```

## Expected vs actual

Expected:

- `TransferFee`: "0–50,000 in units of 0.001% (50,000 = 50%). A non-zero value requires
  `tfMPTCanTransfer` and cannot be combined with `tfMPTCanHoldConfidentialBalance`
  (`temBAD_TRANSFER_FEE`); `0` is always allowed."
- `MaximumAmount`: "A positive integer string, 1 … 9223372036854775807 (2^63−1). Omit for the
  maximum; `'0'` is rejected (`temMALFORMED`)."

Actual: the docs say the opposite of what the validator enforces on both counts, and omit the
confidential-balance rule that the validator (and rippled) do enforce; the `%` unit is missing.

## Root cause

Docs not updated when the validator gained these rules.

## Proposed fix

Docs only, text above.

## Workaround today

Read the validator.

## References

- Related: [008](008-mptokenissuanceset-docs-incomplete.md), [039](039-assetscale-range-not-validated.md)
