# `Credential.Flags` is typed `number | CredentialFlags` although the ledger only returns a number, and the `lsfAccepted` bit value (0x00010000) appears nowhere in the SDK

Severity: minor
Category: types

## Affected surface

- `LedgerEntry.Credential.Flags: number | CredentialFlags` — `packages/xrpl/src/models/ledger/Credential.ts:21`
- `CredentialFlags` — `Credential.ts:5-7` (interface with `lsfAccepted?: boolean`; no enum, no value)
- `grep -rn lsfAccepted packages/xrpl/src` → only that interface key; no `parseCredentialFlags`

## Repro

Live (rippled 3.4.0-rc1, `audit/README.md` round-2 log):

```
Credential.Flags (created, not yet accepted) = 0
Credential.Flags after CredentialAccept       = 65536   (0x00010000)
```

```ts
const cred: LedgerEntry.Credential = …
(cred.Flags & 0x00010000) !== 0
// TS2365: Operator '&' cannot be applied to types 'number | CredentialFlags' and 'number'.
```

## Expected vs actual

Expected: `Flags: number`, plus `enum CredentialFlags { lsfAccepted = 0x00010000 }` and
`parseCredentialFlags(flags)`, mirroring `AccountRootFlags`/`parseAccountRootFlags`. "Has the holder
accepted the credential?" is the admission check of the permissioned-domain route
([028](028-pre-emptive-ban-not-expressible-on-ledger.md)); an unaccepted credential grants nothing
(`domain.ts` run: "issuer pays holder: credential created, not accepted → tecNO_AUTH").

Actual: the field carries the transaction-side "flags as object" union (never returned by the
ledger), and the developer must both `typeof`-guard and hard-code the bit from rippled's
`LedgerFormats.h`.

## Root cause

Same gap as [009](009-mptoken-flags-no-enum-or-parser.md) for a different object, plus a
copy-paste of the transaction `Flags` union onto a ledger type.

## Proposed fix

Non-breaking except for the (unused) object arm of the union:

```ts
export enum CredentialFlags { lsfAccepted = 0x00010000 }
export interface CredentialFlagsInterface { lsfAccepted?: boolean }
export default interface Credential … { Flags: number … }
export function parseCredentialFlags(flags: number): CredentialFlagsInterface
```

## Workaround today

`typeof cred.Flags === 'number' && (cred.Flags & 0x00010000) !== 0`.

## References

- rippled `LedgerFormats.h` (`lsfAccepted = 0x00010000`); XLS-70
- Related: [009](009-mptoken-flags-no-enum-or-parser.md), [028](028-pre-emptive-ban-not-expressible-on-ledger.md)
