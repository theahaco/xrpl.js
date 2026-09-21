# `isDomainID` rejects the all-zero `DomainID`, but that is exactly how rippled clears the domain on `MPTokenIssuanceSet`; the SDK cannot express "remove the domain"

Severity: major
Category: validation

## Affected surface

- `isDomainID` — `packages/xrpl/src/models/transactions/common.ts:1198-1205`
  (`… && domainID !== '0'.repeat(_DOMAIN_ID_LENGTH)`)
- `validateMPTokenIssuanceSet` — `MPTokenIssuanceSet.ts:212` (`validateOptionalField(tx, 'DomainID', isDomainID)`)
- `MPTokenIssuanceSet.DomainID` doc — `MPTokenIssuanceSet.ts:176-180` (does not mention clearing)
- Also used by `validatePayment`, `validateOfferCreate`, `validateMPTokenIssuanceCreate`, … (where
  rejecting zero is correct)

## Repro

`npm run domain` (rippled 3.4.0-rc1), verbatim:

```
switch to domain B (SDK path)                              tesSUCCESS
issuance DomainID == B                                     true
DomainID = 0x00..00 via SDK submitAndWait                  ValidationError: MPTokenIssuanceSet: invalid field DomainID
DomainID = 0x00..00 signed manually (bypassing validate)   tesSUCCESS
issuance DomainID after zero-set                           absent (cleared)
```

`npm run probes` confirms preflight: `Set: DomainID + tfMPTLock (zero hash) | validate:
ValidationError | rippled: tesSUCCESS`. The manual path is `signBypassingValidate` in
`audit/mpt-issuer/src/domain.ts:37-45` (`encodeForSigning` + `ripple-keypairs.sign`), because
`Wallet.sign` calls `validate()` (`Wallet/index.ts:409`) and there is no opt-out.

## Expected vs actual

Expected: an issuer that switched a `RequireAuth` issuance to domain-based admission can switch
back to explicit `MPTokenAuthorize` allow-listing by clearing `DomainID`, using the SDK.

Actual: rippled's `MPTokenIssuanceSet` treats `DomainID == 0` as "make the field absent" (and does
so; the entry loses `DomainID`), but the SDK's generic `isDomainID` guard — written for fields where
zero is meaningless — rejects it before signing. The only ways through are a manual signing path or
`client.submit` with a pre-encoded blob; there is no `MPTokenIssuanceSet` flag or field for
"remove domain". A second side effect: because the zero check runs first, `Set: Holder + DomainID`
reports `invalid field DomainID` instead of the intended "Cannot set both DomainID and Holder"
message (`MPTokenIssuanceSet.ts:214-218`) when the test value happens to be zero.

## Root cause

One guard reused for "reference a domain" and "set-or-clear a domain".

## Proposed fix

Non-breaking (accepts input that was previously rejected):

```ts
// common.ts
export function isDomainIDOrZero(v: unknown): v is string {
  return isString(v) && v.length === _DOMAIN_ID_LENGTH && isHex(v)
}
// MPTokenIssuanceSet.ts
validateOptionalField(tx, 'DomainID', isDomainIDOrZero)
```

and on the field doc: "Set to `'0'.repeat(64)` to remove the domain (rippled makes the field
absent)". Keep `isDomainID` strict everywhere else.

## Workaround today

`audit/mpt-issuer/src/domain.ts:37-45` (`signBypassingValidate`).

## References

- rippled `MPTokenIssuanceSet::doApply` (`if (domainID == beast::zero) sle->makeFieldAbsent(sfDomainID)`)
- XLS-94D / xrpl.org `MPTokenIssuanceSet` (`DomainID`: "Set to all zeros to remove")
- Related: [008](008-mptokenissuanceset-docs-incomplete.md), [028](028-pre-emptive-ban-not-expressible-on-ledger.md)
