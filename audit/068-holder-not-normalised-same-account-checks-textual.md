# `Holder` is skipped by `autofill`'s X-address normalisation and the `Holder === Account` / `issuer` checks compare raw strings, so X-address inputs either bypass the check or die in the codec

Severity: minor
Category: validation

## Affected surface

- `setValidAddresses` — `packages/xrpl/src/sugar/autofill.ts:138-156` (normalises `Account`,
  `Destination`, `Authorize`, `Unauthorize`, `Owner`, `RegularKey`, `Sponsor`, `Sponsee`,
  `CounterpartySponsor`; not `Holder`, `Subject`, `Issuer`)
- `isAccount` accepts X-addresses — `models/transactions/common.ts:377-382`
- Textual self-checks: `validateMPTokenIssuanceSet` — `MPTokenIssuanceSet.ts:245` (`tx.Holder === tx.Account`);
  `validateClawback` — `clawback.ts:54,58` (`tx.Account === tx.Amount.issuer`, `tx.Account === tx.Holder`);
  `validateAMMClawback` — `AMMClawback.ts:88,94`
- The repo already has `areAddressesEqual` — `common.ts:408-410` (used for `Delegate`, `Sponsor`,
  `NFTokenCreateOffer`, `DepositPreauth`)

## Repro

Offline (`audit/README.md` round-2 log):

```
validate(Clawback Holder = tagged X-address)      -> ok
sign(Clawback Holder = tagged X-address)          -> throws Error: Holder cannot have an associated tag
validate(Set   Holder = X-address of Account)     -> ok        (rippled: temMALFORMED)
validate(Clawback Holder = X-address of Account)  -> ok        (rippled: temMALFORMED)
validate(AMMClawback Account = X(issuer), Asset.issuer = r(issuer)) -> ValidationError: Account must be the same as Asset.issuer   (over-strict)
```

## Expected vs actual

Expected: `Holder` (and `Subject`/`Issuer` on credentials) treated like `Destination`: normalised
in `autofill`, a tag rejected with a `ValidationError` naming the field; self-checks use
`areAddressesEqual`.

Actual: untagged X-addresses work only because the codec decodes them; tagged ones fail with a
codec `Error`; the same-account guard is defeated by the X-address form (fee-charging
`temMALFORMED` from rippled) and, on `AMMClawback`, over-rejects a valid pairing.

## Root cause

Field list in `setValidAddresses` not extended for MPT/credential fields; comparisons written before
`areAddressesEqual` existed.

## Proposed fix

Non-breaking:

```ts
// autofill.ts setValidAddresses: add 'Holder', 'Subject', 'Issuer' (transaction-level), 'Delegate'
// validators: replace `a === b` on addresses with areAddressesEqual(a, b)
```

## Workaround today

Use classic addresses everywhere.

## References

- Related: [024](024-holder-field-typing-inconsistent-account-alias.md), [066](066-account-validated-as-string-only.md), [040](040-payment-self-send-not-caught.md)
