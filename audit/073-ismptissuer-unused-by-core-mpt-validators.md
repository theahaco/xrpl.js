# The issuer is encoded in every `MPTokenIssuanceID` and the SDK ships `isMPTIssuer`, but `Clawback`, `MPTokenIssuanceSet`, `MPTokenIssuanceDestroy`, `MPTokenAuthorize` and `VaultClawback` never use it

Severity: minor
Category: validation

## Affected surface

- `isMPTIssuer` — `packages/xrpl/src/models/transactions/common.ts:632-646` (used only by the five
  `ConfidentialMPT*` validators, e.g. `ConfidentialMPTClawback.ts:53`)
- Not used by `validateClawback` (`clawback.ts:45-69`), `validateMPTokenIssuanceSet`
  (`MPTokenIssuanceSet.ts:190`), `validateMPTokenIssuanceDestroy` (`MPTokenIssuanceDestroy.ts:29-34`),
  `validateMPTokenAuthorize` (`MPTokenAuthorize.ts:63-67`), `validateVaultClawback` (`vaultClawback.ts:49-55`)

## Repro

`npm run probes` (rippled 3.4.0-rc1):

```
Set: non-issuer locks              | validate: ok | rippled: tecNO_PERMISSION
Clawback: non-issuer claws back    | validate: ok | rippled: tecNO_PERMISSION
Authorize: issuer opts into own issuance (no Holder)  | validate: ok | rippled: tecNO_PERMISSION
Authorize: non-issuer supplies Holder                 | validate: ok | rippled: tecNO_PERMISSION
```

Control (offline): `ConfidentialMPTClawback` with the same mismatch →
`ValidationError: Account must be the issuer of the MPTokenIssuanceID`.

## Expected vs actual

Expected: since the ID's last 20 bytes *are* the issuer's AccountID, "is `Account` the issuer?" is
decidable from the transaction alone, and the SDK already has the function. `Clawback`/`Set`/
`Destroy` require it; `MPTokenAuthorize` with `Holder` requires it and without `Holder` requires the
opposite. All four are `tec` (fee-charging) failures on rippled.

Actual: [014](014-validatemptokenauthorize-enforces-nothing.md) and the other validators treat these
as ledger-dependent and skip them; the helper exists three files away.

## Root cause

`isMPTIssuer` was added with Confidential MPT and not back-ported.

## Proposed fix

Non-breaking:

```ts
// clawback.ts (MPT branch), MPTokenIssuanceSet.ts, MPTokenIssuanceDestroy.ts
if (!isMPTIssuer(tx.Account, id)) throw new ValidationError('<Type>: Account must be the issuer of the MPTokenIssuanceID')
// MPTokenAuthorize.ts
const issuer = isMPTIssuer(tx.Account, tx.MPTokenIssuanceID)
if (issuer && tx.Holder == null) throw new ValidationError('MPTokenAuthorize: the issuer must specify Holder')
if (!issuer && tx.Holder != null) throw new ValidationError('MPTokenAuthorize: only the issuer may specify Holder')
```

## Workaround today

`isMPTIssuer` is not a public export (`typeof require('xrpl').isMPTIssuer === 'undefined'`); copy
the 20-byte comparison (`audit/mpt-issuer/src/ids.ts` `parseMPTokenIssuanceID`) into application
code.

## References

- Related: [014](014-validatemptokenauthorize-enforces-nothing.md), [036](036-mptokenissuanceid-format-not-validated.md)
