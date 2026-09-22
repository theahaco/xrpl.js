# `MPTokenIssuanceCreate`'s interface doc still says the transaction is "the only opportunity" to set immutable fields "e.g., MPT Flags"; under DynamicMPT they are mutable unless pinned

Severity: minor
Category: docs

## Affected surface

- `MPTokenIssuanceCreate` interface doc — `packages/xrpl/src/models/transactions/MPTokenIssuanceCreate.ts:210-216`
- Contradicted in the same file by `MPTokenIssuanceCreateImmutableFlags` doc (`:66-73`: "By default
  `MPTokenMetadata`, `TransferFee`, and the MPT issuance flags below are mutable via
  MPTokenIssuanceSet") and by `tfMPTokenIssuanceSetEnableFlagMask` (`MPTokenIssuanceSet.ts:79-83`)

## Repro

Doc text (verbatim):

> This transaction is the only opportunity an issuer has to specify any token fields that are
> defined as immutable (e.g., MPT Flags).

Observed (`npm run scenario`, rippled 3.4.0-rc1): `tfMPTSetCanTrade` via `MPTokenIssuanceSet`
succeeds on an unpinned issuance and returns `tecNO_PERMISSION` only when the create pinned
`tifMPTCanTrade` in `ImmutableFlags` ("immutable: pinned-off capability cannot be enabled later").
The repo's own test `mptokenIssuanceSet.test.ts` ("enables every capability flag one-way via
MPTokenIssuanceSet (XLS-94D)") proves the same.

## Expected vs actual

Expected: the doc steers the issuer to the one decision that matters at create time: only
`AssetScale`, `MaximumAmount` and the issuer are fixed; every capability flag, `MPTokenMetadata`
and `TransferFee` can be changed later (flags only in the ON direction) **unless** pinned with
`ImmutableFlags`. A compliance issuer who wants to promise holders "never tradable / never
escrowable / never confidential" must pin those bits here or lose the chance.

Actual: an issuer who trusts the sentence does not set `ImmutableFlags`, and can later be
pressured (or hacked) into enabling `tfMPTSetCanTrade`/`CanEscrow`/`CanHoldConfidentialBalance`.

## Root cause

The interface doc predates DynamicMPT; the `ImmutableFlags` doc was added next to it without
reconciling.

## Proposed fix

Docs only:

```ts
/**
 * Creates an MPTokenIssuance. `AssetScale` and `MaximumAmount` can only be set here. The capability
 * flags, `MPTokenMetadata` and `TransferFee` remain changeable through MPTokenIssuanceSet (flags can
 * only ever be turned on) unless pinned with `ImmutableFlags` (XLS-94D). Set `ImmutableFlags` here
 * for any capability holders must be able to rely on never appearing.
 */
```

## Workaround today

Read the `ImmutableFlags` doc three lines below, or `audit/README.md` "Design mapping".

## References

- XLS-94D (DynamicMPT)
- Related: [008](008-mptokenissuanceset-docs-incomplete.md), [034](034-immutableflags-number-only-no-interface-form.md)
