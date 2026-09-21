# An empty `MPTokenIssuanceID` / `mpt_issuance_id` is signed as the all-zero issuance and an empty `Account` / `Subject` / `Issuer` as `rrrrrrrrrrrrrrrrrrrrrhoLvTp`; `validate()` accepts both

Severity: minor
Category: validation

## Affected surface

- `Hash192` constructor — `packages/ripple-binary-codec/src/types/hash-192.ts:11-13`
  (`if (bytes?.byteLength === 0) bytes = Hash192.ZERO_192.bytes`; `Hash256` has no such rule and
  throws `Invalid Hash length 0`)
- `AccountID.from` — `packages/ripple-binary-codec/src/types/account-id.ts:36-38`
  (`if (value === '') return new AccountID()` → ACCOUNT_ZERO)
- `xrpl` guards that let `''` through: `isString` on `MPTokenIssuanceID` (`MPTokenAuthorize.ts:65`,
  `MPTokenIssuanceSet.ts:192`, `MPTokenIssuanceDestroy.ts:33`), `isMPTAmount` (`common.ts:335-342`),
  `Account` (`common.ts:987`, [066](066-account-validated-as-string-only.md)), `Subject`/`Issuer`
  on credentials ([074](074-permissioned-domain-and-credential-fields-shape-only.md))

## Repro

Offline against the built package (`audit/README.md` round-3 log):

```
validate(Set MPTokenIssuanceID: "")             -> ok
signed Set MPTokenIssuanceID ""                 -> 000000000000000000000000000000000000000000000000
signed Payment Amount {mpt_issuance_id: ""}     -> {"value":"1","mpt_issuance_id":"0000…0000"}
Hash256.from("")                                -> Error: Invalid Hash length 0        (the sibling type is strict)
validate(Set Account: "")                       -> ok
signed Set Account ""                           -> rrrrrrrrrrrrrrrrrrrrrhoLvTp
signed CredentialCreate Subject ""              -> rrrrrrrrrrrrrrrrrrrrrhoLvTp
```

`Holder: ''` is caught (`isAccount`), so the guard exists; it is not applied to these fields.

## Expected vs actual

Expected: an empty string — the canonical "unset env var / empty form field" — is rejected before
signing with a `ValidationError` naming the field.

Actual: the SDK signs a well-formed transaction against the zero issuance or from/for the zero
account and pays a fee to learn `tecOBJECT_NOT_FOUND` / `temMALFORMED` (or, for `Account: ''`,
fails at signing-key mismatch further along). Same family as
[061](061-lowercase-field-names-silently-dropped-when-signing.md): a silent substitution on the
wire.

Round-4 evidence: `packages/xrpl/HISTORY.md:264` (2.13.0) announces "Transaction fields that
represent an address no longer allow an empty string (`''`). If you want to specify ACCOUNT_ZERO,
you can specify `rrrrrrrrrrrrrrrrrrrrrhoLvTp`" — the behaviour this finding shows is exactly the
one the changelog says was removed (it holds for `Destination`/`Holder` via `isAccount`, not for
`Account`, `Subject`, `Issuer`).

## Root cause

Two codec conveniences (zero-fill on empty) plus string-only guards in `xrpl`.

## Proposed fix

Non-breaking:

- `xrpl`: `isMPTokenIssuanceID` ([036](036-mptokenissuanceid-format-not-validated.md)) and
  `isAccount` on `Account`/`Subject`/`Issuer` ([066](066-account-validated-as-string-only.md),
  [074](074-permissioned-domain-and-credential-fields-shape-only.md)) close the sign path.
- Codec: delete the `byteLength === 0` special case in `hash-192.ts` and the `value === ''` case
  in `account-id.ts` (check that no internal caller relies on them; `Issue.from` already treats
  `''` as falsy).

## Workaround today

Guard against empty strings in application code.

## References

- Related: [036](036-mptokenissuanceid-format-not-validated.md), [061](061-lowercase-field-names-silently-dropped-when-signing.md), [066](066-account-validated-as-string-only.md), [074](074-permissioned-domain-and-credential-fields-shape-only.md)
