# `mpt_issuance_id` is optional on the create metadata and the SDK has no helper to derive an MPTokenIssuanceID or the MPT ledger-entry keys

Severity: major
Category: missing-helper

## Affected surface

- `MPTokenIssuanceCreateMetadata.mpt_issuance_id?: string` — `packages/xrpl/src/models/transactions/MPTokenIssuanceCreate.ts:271-273`
- `utils/index.ts` export list — `packages/xrpl/src/utils/index.ts` (has `getNFTokenID`,
  `parseNFTokenID`, `getXChainClaimID`; nothing for MPT)
- `utils/hashes/index.ts` — `hashAccountRoot`, `hashOfferId`, `hashTrustline`, `hashEscrow`,
  `hashPaymentChannel`, `hashVault`, `hashLoanBroker`, `hashLoan` (lines 72-228); no
  `hashMPTokenIssuance` / `hashMPToken`

## Repro

```ts
const res = await client.submitAndWait(createTx, { wallet })
const id: string = res.result.meta.mpt_issuance_id
// TS2322 (after narrowing meta): Type 'string | undefined' is not assignable to type 'string'.
```

The repo's own tests write `mptID!` in every MPT integration test
(`clawback.test.ts:151,159,169,185,195`, `mptokenAuthorize.test.ts:72,92,100`,
`payment.test.ts:144`, `mptokenIssuanceSet.test.ts:83,320`). The issuer project re-derives the ID
and both keylets by hand at `audit/mpt-issuer/src/ids.ts:24-45`; the first attempt at the MPToken
keylet was wrong (hashed the raw 24-byte ID instead of the issuance's 32-byte ledger key) and only
the on-ledger `index` comparison in `inspect.ts` caught it. Both derivations are asserted in
`scenario.ts` ("issue: derived MPTokenIssuanceID == meta.mpt_issuance_id", "ledger_entry index ==
derived keylet", "MPToken keylet derivation").

## Expected vs actual

Expected: a `getMPTokenIssuanceID(meta | tx)` helper (mirror of `getNFTokenID`) and
`hashMPTokenIssuance(issuanceId)` / `hashMPToken(issuanceId, holder)` (mirror of `hashOfferId` and
friends), so an issuer can compute the ID before submission (it is `Sequence ‖ AccountID`, both known
after `autofill`) and look up entries by `index`.

Actual: the only source of the ID is the optional metadata field, which is populated by rippled's
RPC layer only on `tesSUCCESS`, hence the optionality. There is no derivation, and the keylet
algorithm (namespace byte `0x007E` for the issuance over `sequence ‖ issuer`; `0x0074` for the
holder entry over `issuanceKeylet ‖ holder`) is not written down anywhere in the SDK.

## Root cause

MPT support was added without the "derive the object ID" helpers every other object type got.

## Proposed fix

Non-breaking additions:

```ts
// utils/getMPTokenIssuanceID.ts
export function getMPTokenIssuanceID(issuer: string, sequence: number): string {
  const seq = sequence.toString(16).padStart(8, '0').toUpperCase()
  return seq + bytesToHex(decodeAccountID(issuer))
}
/** From validated create metadata; throws unless TransactionResult is tesSUCCESS. */
export function getMPTokenIssuanceIDFromMeta(meta: MPTokenIssuanceCreateMetadata): string

// utils/hashes/index.ts
export function hashMPTokenIssuance(issuanceId: string): string   // sha512Half(0x007E ‖ issuanceId)
export function hashMPToken(issuanceId: string, holder: string): string
  // sha512Half(0x0074 ‖ hashMPTokenIssuance(issuanceId) ‖ accountId(holder))
```

and, in the metadata type, a doc line: "Present iff `TransactionResult === 'tesSUCCESS'`". A
discriminated `MPTokenIssuanceCreateMetadata = Success & { mpt_issuance_id: string } | Failure`
keyed on `TransactionResult` would remove the `!` entirely but touches
[025](025-submitandwait-three-failure-surfaces-no-result-helper.md).

## Workaround today

`audit/mpt-issuer/src/ids.ts` (verified against rippled 3.4.0-rc1).

## References

- rippled `Indexes.cpp`: `keylet::mptIssuance` (`LedgerNameSpace::MPTOKEN_ISSUANCE = '~'`),
  `keylet::mptoken(issuanceKey, holder)` (`LedgerNameSpace::MPTOKEN = 't'`)
- XLS-33 §MPTokenIssuanceID
- Related: [011](011-mptokenissuance-type-lacks-mpt-issuance-id.md), [033](033-autofill-return-type-keeps-filled-fields-optional.md)
