# `MPTokenIssuanceSet` doc comments describe only lock/unlock and misstate the `Holder` field; the one-way `tfMPTSet*` semantics are not on the flag members

Severity: paper-cut
Category: docs

## Affected surface

- `MPTokenIssuanceSet` interface doc — `packages/xrpl/src/models/transactions/MPTokenIssuanceSet.ts:125-128`
- `Holder` doc — `MPTokenIssuanceSet.ts:135-139`
- `MPTokenIssuanceSetFlags.tfMPTSet*` members — `MPTokenIssuanceSet.ts:46-75`
- `MPTokenIssuanceSetFlagsInterface.tfMPTLock/tfMPTUnlock` — `MPTokenIssuanceSet.ts:101-102` (undocumented)

## Repro

Hover `MPTokenIssuanceSet` in an editor:

> The MPTokenIssuanceSet transaction is used to globally lock/unlock a MPTokenIssuance, or
> lock/unlock an individual's MPToken.

Hover `Holder`:

> An optional XRPL Address of an individual token holder balance to lock/unlock. If omitted, this
> transaction will apply to all any accounts holding MPTs.

Hover `tfMPTSetCanLock`:

> Sets the `lsfMPTCanLock` flag. Enables the token to be locked both individually and globally. (XLS-94D)

The issuer project uses the transaction for five different purposes (`audit/mpt-issuer/src/freeze.ts`
lock/unlock, `scenario.ts:143-149` capability mutation, `probes.ts` DomainID and TransferFee and
metadata mutation) and none but the first is discoverable from the docs.

## Expected vs actual

Expected: the interface doc lists everything the transaction does under DynamicMPT and XLS-96:
lock/unlock (global or per-holder), enable capability flags one-way, mutate `MPTokenMetadata`,
`TransferFee`, `ImmutableFlags`, set `DomainID`, register confidential encryption keys. `Holder`
says it is only valid with `tfMPTLock`/`tfMPTUnlock` and cannot be combined with `DomainID`,
mutation fields, or encryption keys (rules the validator at `MPTokenIssuanceSet.ts:214-290` already
enforces). Each `tfMPTSet*` member states that the capability cannot be turned off again.

Actual: the interface doc predates DynamicMPT; the `Holder` sentence "apply to all any accounts" is
a typo; "globally lock" does not mention that issuer-direction payments are exempt
([029](029-protocol-behaviours-sdk-is-silent-about.md)); irreversibility is only documented on the
non-obvious `tfMPTokenIssuanceSetEnableFlagMask` constant (`MPTokenIssuanceSet.ts:79-83`), not on
the members a developer autocompletes.

## Root cause

Doc comments were not updated when DynamicMPT / permissioned-domain / confidential-MPT fields were
added to the model.

## Proposed fix

Non-breaking, docs only. Suggested text:

```ts
/**
 * MPTokenIssuanceSet lets the issuer change an existing issuance:
 * - lock/unlock every holder (`tfMPTLock`/`tfMPTUnlock`, no `Holder`) or one holder (`Holder` set);
 * - enable capabilities one-way via `tfMPTSet*` (XLS-94D; cannot be disabled later);
 * - update `MPTokenMetadata`, `TransferFee`, add `ImmutableFlags`, set `DomainID` (XLS-94D / XLS-80);
 * - register `IssuerEncryptionKey` / `AuditorEncryptionKey` (XLS-96).
 * `Holder` is only valid with a lock/unlock and cannot be combined with any other change.
 * A global lock does not stop payments to or from the issuer; a per-holder lock does.
 */
```

and on each `tfMPTSet*` member: "One-way: once set, the capability cannot be removed."

## Workaround today

Read the validator (`validateMPTokenIssuanceSet`) or XLS-94D.

## References

- XLS-33 (MPT) §MPTokenIssuanceSet; XLS-94D (DynamicMPT); XLS-96 (Confidential MPT)
- Related: [013](013-mptokenauthorize-docs-copy-pasted.md), [029](029-protocol-behaviours-sdk-is-silent-about.md)
