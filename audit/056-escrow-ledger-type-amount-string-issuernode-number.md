# The `Escrow` ledger type declares `Amount: string` and `IssuerNode?: number`; a token escrow's `Amount` is an object and `IssuerNode` is a UInt64 hex string

Severity: minor
Category: types

## Affected surface

- `LedgerEntry.Escrow` — `packages/xrpl/src/models/ledger/Escrow.ts:22-24` (`Amount: string`, with the
  doc "Can represent XRP, an IOU token, or an MPT"), `:72-76` (`IssuerNode?: number`)
- Contrast: `EscrowCreate.Amount: Amount | MPTAmount` — `models/transactions/escrowCreate.ts:28`;
  `Escrow.OwnerNode: string` — `Escrow.ts:59` (the same UInt64 family typed correctly)

## Repro

Live (rippled 3.4.0-rc1, `audit/README.md` round-2 log), `ledger_entry` + `escrow` on an MPT escrow
of 7 units:

```json
"Amount": { "mpt_issuance_id": "000002A4E81F3DB81A22113984FCF242E1F0EFE3B646F413", "value": "7" }
```

```ts
const escrow: LedgerEntry.Escrow = res.result.node /* after narrowing */
escrow.Amount.mpt_issuance_id   // TS2339: Property 'mpt_issuance_id' does not exist on type 'string'
```

`IssuerNode` was absent on this escrow (issuer was the destination); when present it is serialised
like `OwnerNode` (`"0"`), because `sfIssuerNode` is `UInt64` in `definitions.json`.

## Expected vs actual

Expected: `Amount: Amount | MPTAmount` (or `Amount` once [017](017-amount-type-excludes-mptamount.md)
widens it) and `IssuerNode?: string`, matching the transaction type and the codec.

Actual: the doc comment already says the field can be an IOU or MPT while the type says `string`;
anyone reading an MPT escrow back (`tfMPTCanEscrow` issuers) must cast. The audit's own token pins
`tifMPTCanEscrow`, but the type is still wrong for every other issuer.

## Root cause

Ledger type written for XRP escrows; doc updated for XLS-85, type not.

## Proposed fix

Type-only, technically breaking for readers that assumed `string`:

```diff
-  Amount: string
+  Amount: Amount | MPTAmount
…
-  IssuerNode?: number
+  IssuerNode?: string
```

## Workaround today

`escrow.Amount as unknown as MPTAmount`.

## References

- XLS-85 (Token-Enabled Escrows); `packages/ripple-binary-codec/src/enums/definitions.json` (`IssuerNode: UInt64`)
- Related: [017](017-amount-type-excludes-mptamount.md), [010](010-mptoken-ledger-type-mismatches-rippled-json.md)
