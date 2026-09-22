# The holder-side `MPToken` entry has `Flags: number` with no `lsfMPT*` enum, interface, or parser, unlike `MPTokenIssuance`

Severity: minor
Category: missing-helper

## Affected surface

- `MPToken.Flags: number` — `packages/xrpl/src/models/ledger/MPToken.ts:7`
- Contrast: `MPTokenIssuanceFlags`, `MPTokenIssuanceFlagsInterface` —
  `packages/xrpl/src/models/ledger/MPTokenIssuance.ts:103-112, 153-162`; `parseMPTokenIssuanceFlags` —
  `packages/xrpl/src/models/utils/flags.ts:70-85` (exported at `models/index.ts:12`)

## Repro

There is no symbol to import. To answer "is this holder locked / authorized?" the issuer project
defines its own enum and parser at `audit/mpt-issuer/src/inspect.ts:20-46`:

```ts
export enum MPTokenFlags { lsfMPTLocked = 0x00000001, lsfMPTAuthorized = 0x00000002 }
export function parseMPTokenFlags(flags: number): MPTokenFlagsInterface { … }
```

and the bit values had to be verified against the ledger
(`scenario.ts` step "holders: lsfMPTAuthorized bit is 0x2"; `ban.ts` output `Flags: 3` for a locked +
authorized holder).

## Expected vs actual

Expected: symmetric with the issuance: `MPTokenFlags` enum, `MPTokenFlagsInterface`, and
`parseMPTokenFlags(flags)`; ideally also boolean helpers like `isMPTokenLocked(token)`.

Actual: the issuer side is fully modelled, the holder side is a bare number. The two flags a
compliance issuer checks constantly (`lsfMPTLocked`, `lsfMPTAuthorized`) are undiscoverable from the
SDK, and the numeric values are not written anywhere in `packages/xrpl/src`.

## Root cause

Omission when `MPToken.ts` was added; `parseMPTokenIssuanceFlags` was added later for the issuance
only.

## Proposed fix

Non-breaking addition:

```ts
// models/ledger/MPToken.ts
export enum MPTokenFlags {
  /** The holder's balance is locked; payments to or from the holder fail with tecLOCKED. */
  lsfMPTLocked = 0x00000001,
  /** Set by the issuer's MPTokenAuthorize; required for payments when lsfMPTRequireAuth is on. */
  lsfMPTAuthorized = 0x00000002,
}
export interface MPTokenFlagsInterface { lsfMPTLocked?: boolean; lsfMPTAuthorized?: boolean }

// models/utils/flags.ts
export function parseMPTokenFlags(flags: number): MPTokenFlagsInterface { /* same shape as parseMPTokenIssuanceFlags */ }
```

Export both from `models/index.ts` next to `parseMPTokenIssuanceFlags`.

## Workaround today

Hand-roll the two constants (see `audit/mpt-issuer/src/inspect.ts:20-46`).

## References

- rippled `LedgerFormats.h` (`lsfMPTLocked = 0x00000001`, `lsfMPTAuthorized = 0x00000002`)
- Verified on-ledger: `audit/mpt-issuer` ban run (`Flags: 1` locked, `Flags: 2` authorized, `Flags: 3` both)
- Related: [006](006-mptoken-missing-from-ledgerentry-union.md), [010](010-mptoken-ledger-type-mismatches-rippled-json.md)
