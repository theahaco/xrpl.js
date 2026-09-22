# Odd-length hex passes every validator; the signed path drops the last nibble while `simulate`/JSON submit pads the first, so the same object yields different bytes on the wire

Severity: major
Category: validation

## Affected surface

- `isHex` — `packages/xrpl/src/models/utils/index.ts:3,60-62` (`/^[0-9A-Fa-f]+$/u`, no parity)
- Callers: `validateMPTokenIssuanceCreate` (`MPTokenIssuanceCreate.ts:317-325`),
  `validateMPTokenIssuanceSet` (`MPTokenIssuanceSet.ts:316-324`), `validateCredentialType`
  (`common.ts:1088`), `validateURI` (`CredentialCreate.ts:78`), `isMemo` (`common.ts:62-69`),
  `validateHexMetadata` (`common.ts:482-492`)
- Sink: `hexToBytes` — `packages/isomorphic/src/utils/index.ts:67-72` (`Buffer.from(hex, 'hex')`,
  which silently ignores a trailing odd nibble) and `browser.ts:23-39`

## Repro

Live (rippled 3.4.0-rc1, `audit/README.md` round-2 log), one `CredentialCreate` with
`CredentialType: 'ABC'`:

```
simulate(tx_json CredentialType "ABC")        -> tesSUCCESS, NewFields.CredentialType = "0ABC"
submitAndWait(blob, CredentialType "ABC")     -> tesSUCCESS, stored CredentialType = "AB"
```

`validate()` accepted the object both times. Offline: `hexToBytes('ABC')` → `AB`,
`hexToBytes('A')` → empty, `hexToBytes('ABCDE')` → `ABCD`. The same applies to `MPTokenMetadata`,
`URI`, `MemoData`, and the `CredentialType` inside `PermissionedDomainSet.AcceptedCredentials`.

## Expected vs actual

Expected: hex fields must have even length; `validate()` says so with a `ValidationError`, and the
two submission paths agree byte-for-byte.

Actual: two different credentials get created depending on whether the developer previewed with
`simulate` or signed locally; a permissioned domain that accepts `0ABC` will not admit the holder of
`AB`. For `MPTokenMetadata` the stored JSON silently loses its last nibble (usually the closing
brace, making it unparseable by `decodeMPTokenMetadata`).

Round-3 extension (sweep g): the fixed-width `Hash` path has the same hole — `Hash.from`
(`packages/ripple-binary-codec/src/types/hash.ts:29-34`) checks the byte width only *after*
`hexToBytes` dropped the odd nibble, so a 49-character `MPTokenIssuanceID` is accepted and shifted:
`signed Set MPTokenIssuanceID "F"+ID -> F00000001AAAA…AAA` (a different issuance), and
`CredentialIDs: ["F" + 64×C]` is signed as `FCCC…C` (64). 47 characters are caught
(`Invalid Hash length 23`); 49 are not. `isDomainID` is the one field protected by its own length
check.

## Root cause

`isHex` checks the alphabet only; `hexToBytes` is documented as "without the length checks. This
allows us to do our own checks" (`browser.ts:22`), but no caller does.

## Proposed fix

Non-breaking (rejects strings that were never encoded as written):

```ts
export function isHex(str: string): boolean {
  return HEX_REGEX.test(str) && str.length % 2 === 0
}
```

and make `hexToBytes` throw on odd length so the codec cannot be reached with one.

## Workaround today

`hex.length % 2 === 0` in application code (the issuer project only ever encodes via
`stringToHex`/`encodeMPTokenMetadata`, which produce even lengths).

## References

- rippled `strUnHex` (odd length: first char is a lone high nibble → `0A BC`)
- Related: [022](022-binary-codec-silently-truncates-mpt-values-above-2-64.md), [036](036-mptokenissuanceid-format-not-validated.md)
