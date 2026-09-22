# `Issue.from({ currency: 'USD', issuer: '' })` serialises a 20-byte XRP-style `Issue` for a non-XRP currency; `validate()` accepts it and `Wallet.sign` fails decoding its own output

Severity: minor
Category: runtime

## Affected surface

- `Issue.from` — `packages/ripple-binary-codec/src/types/issue.ts:64-75` (`if (value.issuer)` — a
  falsy `''` takes the XRP branch; `isIssueObject` accepts `{ currency }` alone for any currency)
- Reached from `VaultCreate.Asset`, `AMMCreate.Asset/Asset2`, `AMMDeposit`, … (the MPT-adjacent
  `Asset` fields an issuer meets when parking MPTs in a vault)

## Repro

Offline (`audit/README.md` round-3 log):

```
validate(VaultCreate Asset {currency: 'USD', issuer: ''})   -> ok
sign(VaultCreate Asset issuer '')                           -> Error: read: requested 20 bytes but only 0 available
validate(VaultCreate Asset {currency: 'USD'})               -> ValidationError   (caught; only the issuer: '' form slips)
```

`Wallet.sign` decodes what it encoded (for the hash), so the misaligned blob is caught there; a
direct `encode()` user (or `client.submit` of a pre-signed object) would put the malformed bytes on
the wire, where rippled's `STIssue` deserialiser consumes the next 20 bytes as the issuer and rejects
the transaction as invalid.

## Expected vs actual

Expected: `Issue.from` throws for a non-XRP currency without an issuer, and `validate()` treats
`issuer: ''` like a missing issuer.

Actual: an empty issuer flips the branch. Same "empty string is special" family as
[094](094-empty-strings-signed-as-zero-id-or-zero-account.md).

## Root cause

Truthiness check on `issuer`.

## Proposed fix

Non-breaking:

```diff
-    if (value.issuer) {
+    if (value.currency !== 'XRP') {
+      if (typeof value.issuer !== 'string' || value.issuer === '') throw new Error('Issue: issuer is required for non-XRP currencies')
```

and `isCurrency`/`isIssue` in `xrpl` rejecting `issuer: ''`.

## Workaround today

Never pass an empty `issuer`.

## References

- Related: [094](094-empty-strings-signed-as-zero-id-or-zero-account.md), [017](017-amount-type-excludes-mptamount.md)
