# `MPTokenIssuanceID` / `mpt_issuance_id` are validated as "any string"; a malformed ID reaches rippled as an RPC-level `invalid data` error

Severity: minor
Category: validation

## Affected surface

- `validateMPTokenAuthorize` — `packages/xrpl/src/models/transactions/MPTokenAuthorize.ts:65` (`isString`)
- `validateMPTokenIssuanceSet` — `MPTokenIssuanceSet.ts:192` (`isString`)
- `validateMPTokenIssuanceDestroy` — `MPTokenIssuanceDestroy.ts:33` (`isString`)
- `isMPTAmount` — `models/transactions/common.ts:335-342` (`typeof input.mpt_issuance_id === 'string'`)
- `LedgerEntryRequest.mpt_issuance?: string`, `mptoken.mpt_issuance_id: string` — `methods/ledgerEntry.ts:28-38`

## Repro

`npm run probes`:

```
Authorize: bad MPTokenIssuanceID length | validate: ok | rippled: RippledError: Field 'tx_json.MPTokenIssuanceID' has invalid data.
```

With `submitAndWait` the failure moves into the binary codec (`Hash192.from('ABCD')` throws a
generic `Error`) inside `Wallet.sign`, after `validate()` passed.

## Expected vs actual

Expected: an `isMPTokenIssuanceID(value)` guard (`/^[0-9A-Fa-f]{48}$/`, 192 bits) used by the
three validators, by `isMPTAmount`, and exported for callers, mirroring `isDomainID`
(`common.ts:1198-1205`) and the NFT `NFTokenID` checks.

Actual: any string passes `validate()`; the error arrives from rippled (simulate/submit) or from the
codec, neither of which names the field in a `ValidationError`.

## Root cause

Field-level guards were written for shape only.

## Proposed fix

Non-breaking:

```ts
// models/transactions/common.ts
const MPT_ISSUANCE_ID_LENGTH = 48
export function isMPTokenIssuanceID(value: unknown): value is string {
  return isString(value) && value.length === MPT_ISSUANCE_ID_LENGTH && isHex(value)
}
// use in validateMPTokenAuthorize/IssuanceSet/IssuanceDestroy (validateRequiredField(tx, 'MPTokenIssuanceID', isMPTokenIssuanceID))
// and in isMPTAmount for mpt_issuance_id
```

Optionally brand the type (`type MPTokenIssuanceID = string & { __brand: 'MPTokenIssuanceID' }`)
so that IDs, addresses and values cannot be swapped ([024](024-holder-field-typing-inconsistent-account-alias.md)).

## Workaround today

Check the regex in application code.

## References

- XLS-33 §MPTokenIssuanceID (192-bit)
- Related: [014](014-validatemptokenauthorize-enforces-nothing.md), [016](016-mpt-amount-value-not-validated-no-scale-helper.md), [024](024-holder-field-typing-inconsistent-account-alias.md)
