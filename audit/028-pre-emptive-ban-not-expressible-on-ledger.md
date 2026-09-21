# "Pre-emptively ban an address" has no on-ledger representation for MPTs; the SDK documents none of the three partial mechanisms or their limits

Severity: major
Category: protocol-mismatch

## Affected surface

- `MPTokenAuthorize` — `packages/xrpl/src/models/transactions/MPTokenAuthorize.ts:39-55`
- `MPTokenIssuanceSet` (`Holder`, `DomainID`) — `MPTokenIssuanceSet.ts:129-181`
- `MPTokenIssuanceCreateFlags.tfMPTRequireAuth` doc — `MPTokenIssuanceCreate.ts:35-39`
  ("enables issuers to limit who can hold their assets")

## Repro

`audit/mpt-issuer/src/ban.ts` (`npm run ban`) and `scenario.ts` steps `ban: …`, rippled 3.4.0-rc1:

```
issuer authorize mallory pre-emptively (no MPToken)     tecOBJECT_NOT_FOUND
issuer lock mallory pre-emptively (no MPToken)          tecOBJECT_NOT_FOUND
issuer unauthorize mallory pre-emptively (no MPToken)   tecOBJECT_NOT_FOUND
alice pays mallory (no MPToken)                          tecNO_AUTH
mallory opts in (cannot be prevented)                    tesSUCCESS
alice pays mallory (opted in, unauthorized)              tecNO_AUTH
sweep: lock-on-arrival                                   lock -> tesSUCCESS   (zero balance, unauthorized: allowed)
issuer authorizes mallory anyway (operator mistake)      tesSUCCESS
alice pays mallory (authorized but locked)               tecLOCKED            (lock beats auth)
mallory opts out while locked (zero balance)             tecNO_PERMISSION     (stuck with the reserve)
```

`domain.ts` (`npm run domain`) for the permissioned-domain route:

```
issuer pays holder: credential accepted (no MPTokenAuthorize ever)   tesSUCCESS
issuer revokes credential                                            tesSUCCESS
issuer pays holder after revocation                                  tecNO_AUTH
holder redeems to issuer after revocation                            tecNO_AUTH   (balance stays)
```

## Expected vs actual

Expected (the captain's requirement): "an address can be banned before it ever holds the token, and
when it is banned its holdings are frozen".

Actual (what the ledger offers, none of which the SDK explains):

1. **Allow-listing** (`lsfMPTRequireAuth`): a never-authorized address cannot receive. This is the
   only pre-emptive guarantee and it is *implicit* — a ban is "never call `MPTokenAuthorize` with
   this `Holder`". Nothing on-ledger records the decision; the issuer needs an off-ledger registry
   and a guard in front of every authorization.
2. **Per-holder lock** (`MPTokenIssuanceSet` + `Holder` + `tfMPTLock`): only possible once the
   holder's `MPToken` exists (`tecOBJECT_NOT_FOUND` before). Works on a zero-balance, unauthorized
   entry, survives a later authorization, and blocks holder↔holder both ways — so "lock on arrival"
   is the closest thing to a persistent ban. Side effect: the locked holder can never delete the
   entry (`tecNO_PERMISSION`) and keeps paying its reserve.
3. **Permissioned domain** (`DomainID` + credentials): admission by credential instead of by
   `MPTokenAuthorize`; revoking the credential (`CredentialDelete`) blocks send and receive,
   including redemption, but does not lock or claw back, and it is still not pre-emptive (a
   never-issued credential is the same implicit state as 1). `DomainID` cannot be combined with
   `Holder`, and there is no per-address deny-list in a domain.
4. **Opt-in cannot be prevented**: any funded account can create an `MPToken` for any issuance
   (reserve permitting). Under `RequireAuth` that entry is inert, but it exists, and rippled has no
   holder enumeration ([015](015-mpt-holders-request-untyped.md)) so the issuer must poll
   `ledger_entry` per banned address to notice it.

The SDK's types and docs describe fields, not this model. `tfMPTRequireAuth`'s comment is the
closest ("limit who can hold") and says nothing about the above.

## Root cause

XLS-33 has no deny-list primitive; the SDK does not document the composition.

## Proposed fix

Docs plus one helper (non-breaking):

- A "Compliance controls" section in the `MPTokenIssuanceCreate`/`MPTokenAuthorize`/
  `MPTokenIssuanceSet` docs (or the package README) with the table above.
- `@remarks` on `MPTokenAuthorize.Holder` and `MPTokenIssuanceSet.Holder`: "requires the holder's
  MPToken to exist; `tecOBJECT_NOT_FOUND` otherwise".
- Optionally a small sugar `client.getMPToken(issuanceId, account)` returning `undefined` on
  `entryNotFound` (today this needs the `RippledError.data` guard of
  [035](035-rippled-error-data-untyped.md)), which is the primitive every "sweep banned addresses"
  loop needs.

## Workaround today

`audit/mpt-issuer/src/ban.ts`: local registry + `authorizeUnlessBanned` guard + `sweepBanned`
lock-on-arrival + lock-and-clawback for current holders. Documented in `audit/README.md` "Design
mapping".

## References

- XLS-33 (MPT) §Allow-listing, §Locking; XLS-80 (Permissioned Domains); XLS-70 (Credentials)
- Related: [013](013-mptokenauthorize-docs-copy-pasted.md), [015](015-mpt-holders-request-untyped.md), [029](029-protocol-behaviours-sdk-is-silent-about.md)
