# `validateCredentialCreate` caps `URI` at 128 bytes (256 hex chars); rippled allows 256 bytes, so valid credentials cannot be issued through `Wallet.sign`

Severity: major
Category: validation

## Affected surface

- `validateURI` — `packages/xrpl/src/models/transactions/CredentialCreate.ts:15,70-76`
  (`const MAX_URI_LENGTH = 256` … `URI.length > MAX_URI_LENGTH` on the **hex** string)
- Contrast `common.ts:29-30` (`MAX_CREDENTIAL_BYTE_LENGTH = 64; MAX_CREDENTIAL_TYPE_LENGTH = 64 * 2`
  — doubled for `CredentialType`, not for `URI`)
- The unit test codifies the bug: `test/models/CredentialCreate.test.ts:105-109` expects
  `stringToHex('A'.repeat(129))` to throw

## Repro

Live (rippled 3.4.0-rc1, `audit/README.md` round-2 log):

```
validate/sign path with 200-byte URI     -> ValidationError: CredentialCreate: URI length must be <= 256
manually signed 200-byte URI             -> tesSUCCESS
manually signed 300-byte URI             -> temMALFORMED
```

The manual path is `signBypassingValidate` from `audit/mpt-issuer/src/domain.ts` (needed because
`Wallet.sign` calls `validate()`, `Wallet/index.ts:409`).

## Expected vs actual

Expected: 1–256 **bytes** (2–512 hex characters), matching rippled's `maxCredentialURILength = 256`
and XLS-70.

Actual: any verifiable-credential URL longer than 128 bytes is rejected client-side with a message
that quotes the wrong limit. The permissioned-domain admission route
([028](028-pre-emptive-ban-not-expressible-on-ledger.md), option 3) typically carries a URL to the
VC document; 128 bytes is short for those.

## Root cause

Byte limit applied to the hex length.

## Proposed fix

Non-breaking (accepts more):

```diff
-const MAX_URI_LENGTH = 256
+const MAX_URI_BYTE_LENGTH = 256
+const MAX_URI_LENGTH = MAX_URI_BYTE_LENGTH * 2
```

and fix the unit test to `'A'.repeat(257)`. `DIDSet.URI` (`DIDSet.ts:38`) has no length check at
all; align it (rippled: 256 bytes).

## Workaround today

`signBypassingValidate` (`audit/mpt-issuer/src/domain.ts:37-45`).

## References

- rippled `Protocol.h` (`maxCredentialURILength = 256`); XLS-70 §CredentialCreate
- Related: [038](038-isdomainid-rejects-zero-hash-that-clears-domain.md) (the other over-strict validator), [070](070-odd-length-hex-truncated-on-signed-path.md)
