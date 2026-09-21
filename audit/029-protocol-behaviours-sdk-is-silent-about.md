# Eight MPT lock / authorization / clawback behaviours that surprised the issuer project and that no SDK type or doc comment mentions

Severity: minor
Category: docs

## Affected surface

- `MPTokenIssuanceSetFlags.tfMPTLock/tfMPTUnlock` docs — `packages/xrpl/src/models/transactions/MPTokenIssuanceSet.ts:38-45`
- `MPTokenAuthorizeFlags.tfMPTUnauthorize` doc — `MPTokenAuthorize.ts:18-25`
- `Clawback` interface doc — `clawback.ts:15-18`
- `Payment` interface doc — `payment.ts:120-125`

## Repro

All observed on rippled 3.4.0-rc1 via `audit/mpt-issuer` (`freeze`, `ban`, `clawback`, `scenario`
runs; step names in parentheses):

| # | behaviour                                                                                                   | evidence                                                  |
| - | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1 | A **global** lock blocks holder↔holder payments (`tecLOCKED`) but **not** issuer→holder or holder→issuer     | freeze: "issuer pays alice during global lock tesSUCCESS", "bob redeems to issuer during global lock tesSUCCESS" |
| 2 | A **per-holder** lock blocks holder↔holder in both directions, but the locked holder can still redeem to the issuer and the issuer can still pay them | scenario: "lock: individually locked holder CAN still redeem to issuer tesSUCCESS" |
| 3 | Unauthorizing a funded holder (`tfMPTUnauthorize`) keeps the balance but blocks **every** payment, including redemption and issuer→holder (`tecNO_AUTH`) — stricter than a lock | ban: "bob pays issuer 10 while unauthorized tecNO_AUTH", "issuer pays bob 10 while unauthorized tecNO_AUTH" |
| 4 | Lock and authorization are independent bits; lock wins (`tecLOCKED`) when both are set; unauthorize does not clear a lock | ban: "alice pays mallory (authorized but locked) tecLOCKED", "flags after unauthorize { lsfMPTLocked }" |
| 5 | Lock/unlock are idempotent (`tesSUCCESS` when already in that state), so there is no way to tell "already locked" from "just locked" without reading the entry | freeze: "global lock again tesSUCCESS", "unlock alice again tesSUCCESS" |
| 6 | Clawback ignores every freeze state (per-holder lock, global lock, unauthorized) and clamps to the balance (`5000` from `600` → `tesSUCCESS`, balance `0`); an empty holder gives `tecINSUFFICIENT_FUNDS`, a missing entry `tecOBJECT_NOT_FOUND` | clawback run |
| 7 | A payment from a holder with zero balance fails with `tecPATH_PARTIAL`, not `tecUNFUNDED_PAYMENT`/`tecINSUFFICIENT_FUNDS`, even when the holder is locked (the lock check comes later) | scenario: "empty locked holder paying issuer surfaces as tecPATH_PARTIAL" |
| 8 | A locked holder cannot delete its own zero-balance `MPToken` (`tecNO_PERMISSION`), so lock-on-arrival permanently pins their reserve | ban: "mallory opts out while locked tecNO_PERMISSION" |

## Expected vs actual

Expected: the flag and transaction doc comments say what the flag *does* to payments, not just
that it "locks the MPT". Items 1–3 decide whether "freeze" means "no movement at all" or "no
secondary movement", which is the first question a compliance officer asks; item 6 decides whether
an issuer must unlock before clawing back (it must not); items 7–8 are the kind of engine result a
developer will see in production and search the SDK for.

Actual: `tfMPTLock` is documented as "If set, indicates that issuer locks the MPT"; nothing about
issuer-direction exemptions, precedence, idempotency, or interaction with clawback.

## Root cause

Docs transcribe field names from XLS-33 rather than transactor behaviour.

## Proposed fix

Docs only. Concretely, on `tfMPTLock`: "Locks the holder's (or, without `Holder`, every holder's)
balance: payments between holders fail with `tecLOCKED`; payments to and from the issuer still
succeed; `Clawback` still succeeds. Idempotent." On `tfMPTUnauthorize` (issuer case): "Balance is
untouched; all payments involving the holder, including to the issuer, fail with `tecNO_AUTH` until
re-authorized." On `Clawback`: "Succeeds regardless of lock or authorization state; claws back
`min(Amount, balance)`."

## Workaround today

Run `npm run freeze`, `npm run ban`, `npm run clawback` in `audit/mpt-issuer`.

## References

- rippled `Payment.cpp` / `MPTokenIssuanceSet.cpp` / `Clawback.cpp` (behaviour), XLS-33 §Locking, §Clawback
- Related: [008](008-mptokenissuanceset-docs-incomplete.md), [013](013-mptokenauthorize-docs-copy-pasted.md), [028](028-pre-emptive-ban-not-expressible-on-ledger.md)
