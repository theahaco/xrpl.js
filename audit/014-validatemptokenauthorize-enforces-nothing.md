# `validateMPTokenAuthorize` checks field types only; `Holder === Account` and invalid flag bits reach rippled as `tem*`

Severity: minor
Category: validation

## Affected surface

- `validateMPTokenAuthorize` — `packages/xrpl/src/models/transactions/MPTokenAuthorize.ts:63-67`
  (`validateBaseTransaction`, `MPTokenIssuanceID` is string, `Holder` is account — nothing else)
- Contrast: `validateMPTokenIssuanceSet` — `MPTokenIssuanceSet.ts:190-338` (checks lock/unlock
  conflict, `Holder === Account`, `Holder` + `DomainID`, no-op transactions, …)

## Repro

`audit/mpt-issuer/src/probes.ts` (`npm run probes`), rippled 3.4.0-rc1, verbatim rows:

```
Authorize: Holder == Account             | validate: ok | rippled: temMALFORMED     <-- SDK could catch
Authorize: unknown flag bit 0x2          | validate: ok | rippled: temINVALID_FLAG  <-- SDK could catch
Authorize: bad MPTokenIssuanceID length  | validate: ok | rippled: RippledError: Field 'tx_json.MPTokenIssuanceID' has invalid data.
```

For comparison the same class of mistakes on `MPTokenIssuanceSet` is caught client-side
(`Set: Holder == Account | validate: ValidationError: MPTokenIssuanceSet: Holder cannot be the same as
the Account.`).

## Expected vs actual

Expected: preflight-level rules that need no ledger state are enforced by `validate()` with a
`ValidationError` naming the field, before a fee is spent or a round trip made:

- `Holder` must not equal `Account` (rippled: `temMALFORMED`).
- `Flags` must be within the `tfMPTokenAuthorizeMask` (only `tfMPTUnauthorize = 0x1`); anything
  else is `temINVALID_FLAG`.
- `MPTokenIssuanceID` must be 48 hex characters (192 bits) — see
  [036](036-mptokenissuanceid-format-not-validated.md).

Actual: all three pass `validate()`; the first two surface as `tem*` from `submitAndWait` (which
throws an `XrplError` with the code embedded in the message,
[025](025-submitandwait-three-failure-surfaces-no-result-helper.md)), the third as an RPC-level
`RippledError`.

Ledger-dependent rules (`tecNO_PERMISSION` for issuer-without-Holder or non-issuer-with-Holder,
`tecOBJECT_NOT_FOUND`, `tecDUPLICATE`, `tecHAS_OBLIGATIONS`) are correctly out of scope for a
client-side validator, but the doc comment should list them
([013](013-mptokenauthorize-docs-copy-pasted.md)).

## Root cause

The validator was written before rippled's preflight rules were, and was never revisited when the
sibling validators were.

## Proposed fix

Non-breaking (stricter validation of already-invalid input):

```ts
export const tfMPTokenAuthorizeMask = ~MPTokenAuthorizeFlags.tfMPTUnauthorize

export function validateMPTokenAuthorize(tx: Record<string, unknown>): void {
  validateBaseTransaction(tx)
  validateRequiredField(tx, 'MPTokenIssuanceID', isMPTokenIssuanceID)
  validateOptionalField(tx, 'Holder', isAccount)
  if (tx.Holder != null && tx.Holder === tx.Account) {
    throw new ValidationError('MPTokenAuthorize: Holder cannot be the same as the Account.')
  }
  const flags = convertTxFlagsToNumber(tx as Transaction)
  if ((flags & tfMPTokenAuthorizeMask) !== 0) {
    throw new ValidationError('MPTokenAuthorize: invalid Flags')
  }
}
```

Add unit tests mirroring `test/models/MPTokenIssuanceSet.test.ts`.

## Workaround today

Check `Holder !== Account` and the flag mask in application code.

## References

- rippled `MPTokenAuthorize::preflight` (`Holder == Account → temMALFORMED`; `tfMPTokenAuthorizeMask → temINVALID_FLAG`)
- Related: [013](013-mptokenauthorize-docs-copy-pasted.md), [036](036-mptokenissuanceid-format-not-validated.md), [037](037-mpt-validators-do-not-check-flag-masks.md)
