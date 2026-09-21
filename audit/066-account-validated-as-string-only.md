# `validateBaseTransaction` checks `Account` with `isString`, not `isAccount`; a malformed sender address surfaces as ripple-address-codec's `Error: checksum_invalid` / `Unknown letter`

Severity: minor
Category: validation

## Affected surface

- `validateBaseTransaction` — `packages/xrpl/src/models/transactions/common.ts:987`
  (`validateRequiredField(common, 'Account', isString)`); contrast `Destination`/`Holder`/`Delegate`
  which use `isAccount` (`payment.ts:211`, `MPTokenIssuanceSet.ts:193`, `common.ts:1022`)

## Repro

Offline (`audit/README.md` round-2 log):

```
validate(Clawback Account "not-an-address")   -> ok
sign(Clawback Account "not-an-address")       -> throws Error: Unknown letter: "-". Allowed: rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz
sign(Clawback Account with bad checksum)      -> throws Error: checksum_invalid
```

Neither error is an `XrplError`, neither names the field or the transaction type.

## Expected vs actual

Expected: `ValidationError('Clawback: invalid field Account')`, consistent with every other address
field.

Actual: the one field present on every transaction is the one validated most loosely; the failure
leaks from a dependency at sign time. For a service that derives `Account` from configuration, a
mis-pasted issuer address is the first thing that goes wrong.

## Root cause

Historical: `isAccount` was added later and applied to new fields only.

## Proposed fix

Non-breaking (rejects only addresses the codec would reject anyway):

```diff
-  validateRequiredField(common, 'Account', isString)
+  validateRequiredField(common, 'Account', isAccount)
```

## Workaround today

`isValidClassicAddress(account)` in application code.

## References

- Related: [024](024-holder-field-typing-inconsistent-account-alias.md), [068](068-holder-not-normalised-same-account-checks-textual.md)
