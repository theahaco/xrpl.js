# MPT audit — fix plan

Epic: https://github.com/theahaco/xrpl.js/issues/2 · Audit PR: https://github.com/theahaco/xrpl.js/pull/1 · Findings: `audit/001`–`audit/107`

One unit = one branch = one PR that can be implemented, tested and reviewed independently. File paths are relative to `packages/xrpl/src/` unless they start with `packages/`, `.ci-config/` or a repo-root name.

| unit | sub-issue | findings | affected files | breaking | depends-on | branch | size |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `mpt-ledger-types` | [#3](https://github.com/theahaco/xrpl.js/issues/3) | 006, 009, 010, 011, 031, 059 | `models/ledger/LedgerEntry.ts`, `models/ledger/MPToken.ts`, `models/ledger/MPTokenIssuance.ts`, `models/ledger/Credential.ts`, `models/ledger/index.ts`, `models/index.ts`, `models/utils/flags.ts` | no | none | `fm/xrpljs-mpt-ledger-types` | M |
| `response-narrowing` | [#4](https://github.com/theahaco/xrpl.js/issues/4) | 005, 007, 058, 078 | `models/methods/ledgerEntry.ts`, `models/methods/accountObjects.ts`, `models/methods/index.ts`, `models/methods/subscribe.ts`, `models/methods/accountTx.ts`, `client/index.ts` | no | `mpt-ledger-types` | `fm/xrpljs-response-narrowing` | M |
| `submit-path-typing` | [#5](https://github.com/theahaco/xrpl.js/issues/5) | 001, 002, 030, 033 | `models/methods/tx.ts`, `Wallet/index.ts`, `client/index.ts`, `sugar/submit.ts`, `models/methods/simulate.ts` | no | `submitandwait-outcomes` | `fm/xrpljs-submit-path-typing` | M |
| `rpc-response-shapes` | [#6](https://github.com/theahaco/xrpl.js/issues/6) | 018, 032, 054, 055, 056, 060 | `models/methods/ledgerEntry.ts`, `models/methods/feature.ts`, `models/methods/ledgerData.ts`, `models/ledger/Escrow.ts` | no | none | `fm/xrpljs-rpc-response-shapes` | M |
| `strict-transaction-types` | [#7](https://github.com/theahaco/xrpl.js/issues/7) | 004 | `models/transactions/common.ts`, `models/transactions/transaction.ts`, `models/transactions/index.ts` | yes | none | `fm/xrpljs-strict-transaction-types` | L |
| `strict-request-types` | [#8](https://github.com/theahaco/xrpl.js/issues/8) | 055, 026 | `models/methods/baseMethod.ts`, `models/methods/index.ts`, `client/index.ts` | yes | none | `fm/xrpljs-strict-request-types` | M |
| `amount-type-mpt` | [#9](https://github.com/theahaco/xrpl.js/issues/9) | 017, 057 | `models/common/index.ts`, `models/transactions/payment.ts`, `models/transactions/common.ts`, `models/transactions/metadata.ts`, `models/methods/tx.ts`, `models/methods/accountTx.ts` | yes | none | `fm/xrpljs-amount-type-mpt` | M |
| `codec-mpt-amount-hardening` | [#10](https://github.com/theahaco/xrpl.js/issues/10) | 022, 023, 096, 085 | `packages/ripple-binary-codec/src/types/amount.ts`, `packages/ripple-binary-codec/src/types/uint-32.ts`, `packages/ripple-binary-codec/src/types/uint-64.ts`, `packages/ripple-binary-codec/test/amount.test.ts`, `packages/ripple-binary-codec/test/fixtures/data-driven-tests.json` | no | none | `fm/xrpljs-codec-mpt-amount-hardening` | S |
| `codec-hex-and-empty-inputs` | [#11](https://github.com/theahaco/xrpl.js/issues/11) | 070, 094, 095, 097 | `packages/isomorphic/src/utils/index.ts`, `packages/isomorphic/src/utils/browser.ts`, `packages/ripple-binary-codec/src/types/hash.ts`, `packages/ripple-binary-codec/src/types/hash-192.ts`, `packages/ripple-binary-codec/src/types/account-id.ts`, `packages/ripple-binary-codec/src/types/issue.ts`, `packages/ripple-binary-codec/src/types/uint.ts`, `packages/ripple-binary-codec/src/types/uint-64.ts`, `packages/ripple-binary-codec/src/types/st-object.ts` | no | none | `fm/xrpljs-codec-hex-and-empty-inputs` | M |
| `mpt-validators` | [#12](https://github.com/theahaco/xrpl.js/issues/12) | 014, 016, 036, 037, 039, 073, 075, 076 | `models/transactions/common.ts`, `models/transactions/MPTokenAuthorize.ts`, `models/transactions/MPTokenIssuanceCreate.ts`, `models/transactions/MPTokenIssuanceSet.ts`, `models/transactions/MPTokenIssuanceDestroy.ts`, `models/transactions/clawback.ts`, `models/utils/index.ts`, `models/utils/mptokenMetadata.ts` | no | `codec-mpt-amount-hardening` | `fm/xrpljs-mpt-validators` | M |
| `payment-escrow-credential-validators` | [#13](https://github.com/theahaco/xrpl.js/issues/13) | 040, 041, 042, 066, 068, 072, 074, 089 | `models/transactions/payment.ts`, `models/transactions/escrowCreate.ts`, `models/transactions/escrowFinish.ts`, `models/transactions/common.ts`, `models/transactions/permissionedDomainSet.ts`, `models/transactions/CredentialCreate.ts`, `models/transactions/CredentialAccept.ts`, `models/transactions/CredentialDelete.ts`, `models/transactions/delegateSet.ts`, `sugar/autofill.ts` | no | none | `fm/xrpljs-payment-escrow-credential-validators` | M |
| `sign-path-hardening` | [#14](https://github.com/theahaco/xrpl.js/issues/14) | 061, 064, 065 | `Wallet/index.ts`, `models/transactions/common.ts`, `models/transactions/transaction.ts`, `sugar/autofill.ts` | no | `mpt-validators` | `fm/xrpljs-sign-path-hardening` | M |
| `over-strict-validators` | [#15](https://github.com/theahaco/xrpl.js/issues/15) | 038, 071 | `models/transactions/common.ts`, `models/transactions/MPTokenIssuanceSet.ts`, `models/transactions/CredentialCreate.ts`, `models/transactions/DIDSet.ts`, `packages/xrpl/test/models/CredentialCreate.test.ts` | no | none | `fm/xrpljs-over-strict-validators` | S |
| `submitandwait-outcomes` | [#16](https://github.com/theahaco/xrpl.js/issues/16) | 062, 063, 025, 043, 081 | `sugar/submit.ts`, `client/index.ts`, `errors.ts`, `utils/index.ts`, `utils/getTransactionResultCode.ts`, `utils/isTesSuccess.ts` | no | none | `fm/xrpljs-submitandwait-outcomes` | M |
| `autofill-tickets-and-batch-sequences` | [#17](https://github.com/theahaco/xrpl.js/issues/17) | 086, 098, 087, 100, 101, 107 | `client/index.ts`, `sugar/autofill.ts`, `packages/xrpl/test/client/autofill.test.ts` | no | none | `fm/xrpljs-autofill-tickets-and-batch-sequences` | M |
| `batch-signing` | [#18](https://github.com/theahaco/xrpl.js/issues/18) | 090, 102, 103, 104, 105, 106 | `Wallet/batchSigner.ts`, `Wallet/signer.ts`, `sugar/submit.ts`, `packages/xrpl/test/wallet/batchSigner.test.ts` | no | `autofill-tickets-and-batch-sequences` | `fm/xrpljs-batch-signing` | M |
| `batch-validation-and-types` | [#19](https://github.com/theahaco/xrpl.js/issues/19) | 099, 092, 091 | `models/transactions/batch.ts`, `sugar/autofill.ts`, `client/index.ts`, `packages/xrpl/test/models/batch.test.ts` | no | none | `fm/xrpljs-batch-validation-and-types` | M |
| `batch-outcomes` | [#20](https://github.com/theahaco/xrpl.js/issues/20) | 088 | `models/transactions/batch.ts`, `models/transactions/metadata.ts`, `client/index.ts`, `utils/index.ts` | no | `autofill-tickets-and-batch-sequences` | `fm/xrpljs-batch-outcomes` | S |
| `mpt-helpers` | [#21](https://github.com/theahaco/xrpl.js/issues/21) | 012, 082, 083, 016, 080, 003 | `utils/index.ts`, `utils/hashes/index.ts`, `utils/hashes/ledgerSpaces.ts`, `utils/quality.ts`, `confidential/ledger.ts`, `models/transactions/index.ts`, `models/transactions/MPTokenIssuanceCreate.ts` | no | `mpt-ledger-types`, `rpc-additions` | `fm/xrpljs-mpt-helpers` | M |
| `rpc-additions` | [#22](https://github.com/theahaco/xrpl.js/issues/22) | 015, 035, 079 | `models/methods/mptHolders.ts`, `models/methods/index.ts`, `errors.ts`, `client/index.ts`, `sugar/submit.ts` | no | none | `fm/xrpljs-rpc-additions` | M |
| `balance-helpers-mpt` | [#23](https://github.com/theahaco/xrpl.js/issues/23) | 077, 053 | `client/index.ts`, `sugar/balances.ts`, `utils/getBalanceChanges.ts`, `models/common/index.ts` | no | `mpt-ledger-types` | `fm/xrpljs-balance-helpers-mpt` | M |
| `mpt-transaction-type-polish` | [#24](https://github.com/theahaco/xrpl.js/issues/24) | 024, 034 | `models/transactions/clawback.ts`, `models/transactions/MPTokenIssuanceCreate.ts`, `models/transactions/MPTokenIssuanceSet.ts`, `models/utils/flags.ts` | no | none | `fm/xrpljs-mpt-transaction-type-polish` | S |
| `error-hygiene` | [#25](https://github.com/theahaco/xrpl.js/issues/25) | 027, 067, 069 | `models/transactions/MPTokenIssuanceCreate.ts`, `models/transactions/MPTokenIssuanceSet.ts`, `client/index.ts`, `sugar/autofill.ts`, `models/utils/flags.ts`, `errors.ts`, `Wallet/index.ts` | no | none | `fm/xrpljs-error-hygiene` | S |
| `test-infra` | [#26](https://github.com/theahaco/xrpl.js/issues/26) | 019, 020, 021, 084 | `packages/xrpl/test/integration/README.md`, `packages/xrpl/test/integration/utils.ts`, `packages/xrpl/test/integration/setup.ts`, `CONTRIBUTING.md`, `.ci-config/xrpld.cfg`, `.ci-config/getNewAmendments.js` | no | `submitandwait-outcomes` | `fm/xrpljs-test-infra` | M |
| `mpt-transaction-docs` | [#27](https://github.com/theahaco/xrpl.js/issues/27) | 008, 013, 029, 046, 047, 049, 093 | `models/transactions/MPTokenAuthorize.ts`, `models/transactions/MPTokenIssuanceSet.ts`, `models/transactions/MPTokenIssuanceCreate.ts`, `models/transactions/clawback.ts`, `models/transactions/ConfidentialMPTClawback.ts`, `models/ledger/MPTokenIssuance.ts` | no | none | `fm/xrpljs-mpt-transaction-docs` | S |
| `client-and-ledger-docs` | [#28](https://github.com/theahaco/xrpl.js/issues/28) | 044, 048, 045, 050, 051, 052 | `client/index.ts`, `Wallet/index.ts`, `models/transactions/MPTokenIssuanceCreate.ts`, `models/transactions/MPTokenIssuanceSet.ts`, `models/ledger/MPTokenIssuance.ts`, `models/ledger/MPToken.ts`, `models/methods/accountObjects.ts`, `models/methods/ledgerEntry.ts`, `models/common/index.ts` | no | none | `fm/xrpljs-client-and-ledger-docs` | S |
| `no-action-notes` | [#29](https://github.com/theahaco/xrpl.js/issues/29) | 028 | `models/transactions/MPTokenAuthorize.ts`, `models/transactions/MPTokenIssuanceSet.ts`, `packages/xrpl/README.md` | no | `mpt-transaction-docs` | `fm/xrpljs-no-action-notes` | S |

## Ordering rationale

**Wave 0 — stop the bleeding (independent, small, ship first).** `codec-mpt-amount-hardening`
(022 blocker), `codec-hex-and-empty-inputs` (070 major + 094/095/097), `sign-path-hardening`
(061 blocker), `submitandwait-outcomes` (062 major), `autofill-tickets-and-batch-sequences`
(086/087/098/100/101 major). Each is a few lines in one file, rejects only input that was already
wrong on the wire or fixes a silent no-op, and needs no type migration. `sign-path-hardening`
nominally depends on `mpt-validators` (it wants `isMPTValue` for the MPT-amount rewrite) but its
blocker half — reject unknown keys, restore the round-trip — can land alone.

**Wave 1 — make the read path typeable.** `mpt-ledger-types` first (adds `MPToken` to the union
and fixes its fields); then `response-narrowing`, `balance-helpers-mpt` and `mpt-helpers`, which
all return or narrow to those types. `rpc-response-shapes` and `rpc-additions` are independent of
each other and of the ledger-types unit and can run in parallel with it (`mpt-helpers` also wants
`rpc-additions` for the typed `RippledError.data` that its `orUndefined` variant uses).

**Wave 2 — validators.** `mpt-validators` (after the codec grammar in wave 0 so the two layers
agree), `payment-escrow-credential-validators`, `over-strict-validators`, `batch-validation-and-types`
— independent of each other; each closable by one PR with `audit/mpt-issuer`'s `npm run probes`
as the oracle. Then `batch-signing` and `batch-outcomes` (both after
`autofill-tickets-and-batch-sequences`, whose fixes their integration tests rely on).

**Wave 3 — typing that touches the public shape.** `submit-path-typing` after
`submitandwait-outcomes` (so `ValidatedTxResponse` and `TransactionFailedError` are designed
together). The three **breaking** units — `strict-transaction-types`, `strict-request-types`,
`amount-type-mpt` — are deliberately separate from everything else and from each other; they belong
to one major release and should be reviewed as a set, but each is its own PR so the blast radius is
visible per change. Land them last.

**Docs and infra, any time.** `mpt-transaction-docs`, `client-and-ledger-docs`, `error-hygiene`,
`mpt-transaction-type-polish` are independent and small. `test-infra` should follow
`submitandwait-outcomes` so the harness can switch to `submitAndWait` without hitting the false
expiry. `no-action-notes` closes once `mpt-transaction-docs` carries the compliance-controls
section (or the maintainers decide the note belongs on xrpl.org).

## Units that must be serialized

- `mpt-ledger-types` → `response-narrowing`, `balance-helpers-mpt`, `mpt-helpers` (shared types).
- `codec-mpt-amount-hardening` → `mpt-validators` → `sign-path-hardening` (one value grammar in three layers).
- `submitandwait-outcomes` → `submit-path-typing`, `test-infra`.
- `autofill-tickets-and-batch-sequences` → `batch-signing`, `batch-outcomes` (integration tests need working ticket/sequence handling).
- `rpc-additions` → `mpt-helpers` (typed error data).
- `mpt-transaction-docs` → `no-action-notes`.
- The three breaking units are independent of each other but must be released together; do not
  merge any of them before the non-breaking waves have shipped, so that a minor release can carry
  the fixes users need most.

## Shared findings

016 is split between `mpt-validators` (the value grammar) and `mpt-helpers` (`mptToUnits`/`unitsToMpt`);
055 between `rpc-response-shapes` (missing lookup members) and `strict-request-types` (the index
signature). Each sub-issue states which half it owns.

## How to work a unit

1. Branch `fm/xrpljs-<slug>` from `main`; read the linked `audit/NNN` files — each carries the repro, the
   expected behaviour and a proposed diff.
2. Add the tests named in the sub-issue's acceptance criteria first (unit tests under
   `packages/xrpl/test/models` or `test/client`; integration tests against `rippleci/xrpld:develop`
   with the recipe in `audit/README.md`).
3. Re-run `audit/mpt-issuer`: `npm run scenario` must stay green; `npm run type-repros` is expected to
   start failing on the repros the unit fixes — delete those repros in the same PR as proof.
4. Tick the acceptance boxes in the sub-issue; the epic checklist tracks the units.

