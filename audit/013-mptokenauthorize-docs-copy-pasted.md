# `MPTokenAuthorize` interface and `Holder` doc comments are copy-pasted from `MPTokenIssuanceSet` and describe the wrong transaction

Severity: minor
Category: docs

## Affected surface

- `MPTokenAuthorize` interface doc — `packages/xrpl/src/models/transactions/MPTokenAuthorize.ts:39-42`
- `Holder` doc — `MPTokenAuthorize.ts:49-52`
- `MPTokenAuthorizeFlagsInterface.tfMPTUnauthorize` — `MPTokenAuthorize.ts:36` (no doc)

## Repro

Hover `MPTokenAuthorize`:

> The MPTokenAuthorize transaction is used to globally lock/unlock a MPTokenIssuance, or lock/unlock
> an individual's MPToken.

Hover `Holder`:

> An optional XRPL Address of an individual token holder balance to lock/unlock. If omitted, this
> transaction will apply to all any accounts holding MPTs.

Neither sentence is true of this transaction. The issuer project needed four different uses of it
(`audit/mpt-issuer/src/holders.ts:13-46`: holder opt-in, holder opt-out, issuer authorize, issuer
unauthorize) and had to learn the rules from the enum comment on `tfMPTUnauthorize` and from rippled
(`probes.ts` rows "Authorize: …").

## Expected vs actual

Expected (what the ledger does, verified in `ban.ts` / `probes.ts` on rippled 3.4.0-rc1):

- Submitted by a prospective holder without `Holder`: creates the holder's (empty, unauthorized)
  `MPToken` entry and charges reserve. Second attempt: `tecDUPLICATE`. Cannot be prevented by the
  issuer.
- Holder + `tfMPTUnauthorize`: deletes the holder's `MPToken`; `tecHAS_OBLIGATIONS` if the balance
  is non-zero; `tecNO_PERMISSION` if the entry is locked (even with zero balance).
- Submitted by the issuer with `Holder`: sets `lsfMPTAuthorized` on that holder's existing entry
  (allow-listing under `lsfMPTRequireAuth`); `tecOBJECT_NOT_FOUND` if the holder has not opted in.
  With `tfMPTUnauthorize`: clears the flag; the balance stays and the holder can no longer send or
  receive (including redemption to the issuer: `tecNO_AUTH`).
- Issuer without `Holder`: `tecNO_PERMISSION`. Non-issuer with `Holder`: `tecNO_PERMISSION`.
  `Holder === Account`: `temMALFORMED`.

Actual: the doc block describes `MPTokenIssuanceSet`; the meaning of `Holder` (present only when the
issuer is the sender) and of `tfMPTUnauthorize` (two different meanings depending on sender) is only
partially described on the flag enum member (`MPTokenAuthorize.ts:18-25`).

## Root cause

File created by copying `MPTokenIssuanceSet.ts` and not re-documented.

## Proposed fix

Docs only:

```ts
/**
 * MPTokenAuthorize has two roles depending on who sends it:
 * - A prospective holder (no `Holder`) opts in: creates its MPToken entry (reserve applies).
 *   With `tfMPTUnauthorize` it opts out and deletes the entry (balance must be 0 and the entry unlocked).
 * - The issuer (with `Holder`) authorizes that holder's existing entry (`lsfMPTAuthorized`),
 *   required for payments when the issuance has `lsfMPTRequireAuth`. With `tfMPTUnauthorize` it
 *   revokes authorization; the balance is untouched but the holder can no longer send or receive.
 * The issuer cannot authorize or unauthorize an address that has not opted in (tecOBJECT_NOT_FOUND).
 */
export interface MPTokenAuthorize extends BaseTransaction {
  /** Only valid when the sender is the issuer: the holder whose entry to (un)authorize. Must differ from Account. */
  Holder?: Account
```

## Workaround today

Read XLS-33 / xrpl.org `MPTokenAuthorize`.

## References

- XLS-33 §MPTokenAuthorize; xrpl.org "MPTokenAuthorize"
- `audit/mpt-issuer` ban and probes runs (engine results above)
- Related: [008](008-mptokenissuanceset-docs-incomplete.md), [014](014-validatemptokenauthorize-enforces-nothing.md)
