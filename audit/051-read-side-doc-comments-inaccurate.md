# Read-side doc comments are inaccurate: `LockedAmount` cites payment channels, `ReferenceHolding` describes a vault, the `AccountObject` list predates MPT, and the `ledger_entry` MPT parameters do not say what to pass

Severity: paper-cut
Category: docs

## Affected surface

- `MPTokenIssuance.LockedAmount` doc — `packages/xrpl/src/models/ledger/MPTokenIssuance.ts:64-68`
- `MPTokenIssuance.ReferenceHolding` doc — `MPTokenIssuance.ts:80-85`
- `MPToken.LockedAmount` — `models/ledger/MPToken.ts:9` (no doc)
- `AccountObject` doc — `packages/xrpl/src/models/methods/accountObjects.ts:50-53`
- `LedgerEntryRequest.mpt_issuance` / `mptoken` docs — `packages/xrpl/src/models/methods/ledgerEntry.ts:25-38`

## Repro

Verbatim:

- `LockedAmount`: "The total amount of this MPT that is currently locked across all holders via
  Escrow or PaymentChannel." — payment channels are XRP-only (`models/ledger/PayChannel.ts:32`
  `Amount: string`; `paymentChannelCreate.ts:22-27` "Amount of XRP, in drops"); `LockedAmount` is
  maintained by token escrow (XLS-85) only. The MPT escrow created in this audit's round-2 log
  (`Amount: { mpt_issuance_id, value: '7' }`) is the only thing that populates it.
- `ReferenceHolding`: "Hash256 pointing to the vault pseudo-account's holding for the underlying
  asset. Present for IOU and MPT-backed vaults. Absent for XRP-backed vaults." — this field exists
  only on the *share-token* issuance a Single Asset Vault creates
  (`test/integration/transactions/singleAssetVault.test.ts:156-162`); an ordinary MPT issuer reading
  "present for MPT-backed…" thinks it applies to their token.
- `AccountObject`: "Account Objects can be a Check, a DepositPreauth, an Escrow, an Offer, a
  PayChannel, a SignerList, a Ticket, or a RippleState." — the type it annotates already includes
  `MPTokenIssuance` and the filter has `mpt_issuance`/`mptoken`.
- `ledger_entry`: "Retrieve a MPTokenIssuance object from the ledger." / "Retrieve a MPToken object
  from the ledger." — does not say that `mpt_issuance` takes the 48-hex `MPTokenIssuanceID` (not
  the ledger index) or that the string form of `mptoken` is the entry's ledger `index`.

## Expected vs actual

Expected: field docs that say what populates them and what to pass; the `AccountObject` list
matching the union.

Actual: four small inaccuracies that each cost a round trip to xrpl.org.

## Root cause

Docs copied from the spec drafts / other objects.

## Proposed fix

Docs only:

- `LockedAmount` (both types): "Total of this MPT held in Escrow (XLS-85) — across all holders on the
  issuance, for this holder on the MPToken. Absent when nothing is escrowed."
- `ReferenceHolding`: "Only on the share-token issuance of a Single Asset Vault (XLS-65): ledger index
  of the vault pseudo-account's holding of the underlying IOU/MPT. Absent on ordinary issuances."
- `AccountObject`: drop the enumeration or make it complete.
- `mpt_issuance`: "The 192-bit `MPTokenIssuanceID` (48 hex characters), not the ledger index."
  `mptoken`: "Either the MPToken's ledger index, or `{ mpt_issuance_id, account }`."

## Workaround today

xrpl.org.

## References

- XLS-85 (token escrow), XLS-65 (Single Asset Vault)
- Related: [010](010-mptoken-ledger-type-mismatches-rippled-json.md), [011](011-mptokenissuance-type-lacks-mpt-issuance-id.md)
