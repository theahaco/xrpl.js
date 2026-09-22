# Validation summary

Audit date: 22 September 2026. Published baseline: **xrpl 5.3.0**. Unreleased aha prototype: **5.3.0-aha.devx.0**. Consumer compiler: **TypeScript 5.9.3**. The prototype is evidence for a proposed improvement programme; it is not a production release.

## Current wallet-builder revision

The latest SDK adds wallet-bound builders, command discovery and SDK-owned transaction-success handling. The complete suite passes **141 suites / 1,404 tests**. **25/25** editor/compiler checks pass, including all **78 transaction factories / 45 commands**, and the four prototype ledger journeys pass. Builds pass; changed-file lint has zero errors and 16 style warnings. See the [current follow-up](builders-follow-up.md) for evidence, migration and limits.

The table below records the earlier audit revision. Its packed artifact and caller-owned result checks are historical evidence, not validation of the current failure contract.

## Earlier audit revision

| Check | Recorded result | Evidence and scope |
|---|---|---|
| Public API inventory | 447 named root exports across 18 families | [Inventory](api-inventory.json), [coverage](api-coverage.md). Includes public Client/Wallet members and 69 additional qualified namespace/object members. Inventory does not establish behavioral correctness. |
| Selected developer journeys | Published baseline 3/16; built prototype 16/16 | [Baseline](journey-baseline.json), [prototype](journey-prototype.json). Deliberately selected compiler criteria demonstrate the targeted changes; these are not an SDK-wide quality score. |
| Complete xrpl package unit suite | 140/140 suites; 1,396/1,396 tests; zero failures or skipped tests | [Machine results](prototype-unit-results.json), [log](prototype-unit-tests.txt). Includes local mock WebSocket servers; completed in 104.931 seconds. |
| Changed SDK TypeScript lint | 59 files; zero errors and warnings | [Results](prototype-lint.json). Scope is the changed/new files, not a claim about repository-wide lint. |
| SDK build and whitespace check | Passed | [Detailed validation](prototype-validation.md). Declarations were rebuilt before the final consumer checks. |
| Portal TypeScript review | Seven existing families source-reviewed and baseline-compiled | [Coverage](portal-coverage.json), [baseline compilation](portal-baseline-compile.json). Compilation alone did not expose unchecked `any` or wrong transaction-result handling. |
| Revised and prototype examples | Four workflows compiled for each SDK target | [Published SDK examples](portal-improved-compile.json), [prototype examples](portal-prototype-compile.json). Get Started, Send XRP, MPT metadata issuance and guided AMM creation. |
| Isolated ledger journeys | Published baseline 4/4; prototype 4/4 | [Baseline execution](runtime-baseline.json), [prototype execution](runtime-prototype.json). Actual transactions on standalone rippled 3.4.0-rc1. |
| Validated failure outcome | Both Send XRP examples correctly rejected `tecUNFUNDED_PAYMENT` | [Negative-outcome evidence](runtime-negative-outcomes.json). SDK promises resolved with a validated failure; the examples checked the final metadata. Sender paid only the 12-drop fee and receiver balance did not change. |
| Packed Node/declaration consumer | 16/16 selected criteria; restored documentation on four sampled APIs | [Package verification](package-verification.json), [packed journeys](journey-packed.json), [hover probes](surface-probes-packed.json). Actual `npm pack --ignore-scripts` output after the build; dependencies came from the pinned harness. |
| Portal preview | Local Realm preview rendered 2,626 pages with no errors; 66 referenced snippet paths present | [Preview record](preview-status.md), [reference checks](portal-docs-reference-check.json). Three existing sidebar warnings remained. No hosted preview was deployed. |

## Runtime boundary

The ledger runs used this pinned container image:

```text
rippleci/xrpld@sha256:898feb090a777fddce725b6e4af776194bbead943a02e8cc80b4b0c4556d2a52
```

The server reported `3.4.0-rc1`. [Configuration](../harness/docker/rippled.cfg) and [active-feature evidence](local-ledger-active-features.json) accompany the results. The supplied amendment configuration plus fresh-genesis startup enabled DynamicMPT, AMM and MPTokensV1; not every configured ID is reported active. [The earlier feature inventory](local-ledger-features.json) records available/supported features before the run. These runs used fresh accounts funded from the public deterministic genesis account of an isolated standalone ledger. They did not use production accounts, real assets or public faucets. They do not establish amendment availability or behavior on Mainnet, Testnet or Devnet. The baseline runtime results exercise the **revised examples compatible with published 5.3.0**, rather than the untouched legacy examples.

The negative-outcome run adds one real validated `tec` branch. It is not exhaustive testing of expiry, reconnection, competing transactions, every engine result or all network failure modes. Earlier sandbox-only unit failures were environmental local-listener failures; the successful complete unit run allowed those local mock servers to bind.

## Compatibility and remaining work

- The prototype's declaration syntax uses const type parameters, requiring **TypeScript 5.0 or later**. Validation used 5.9.3; a supported compiler-version matrix remains release work.
- `submitAndWait` confirms transactions through an explicit **API v2 lookup**, including on a client configured for another API version. This makes the refined result shape consistent but is a compatibility decision that needs release review and server support checks. The prototype retains published 5.3 finality polling. The current follow-up adds SDK classification of the final validated outcome and documents the breaking success contract.
- `SignedBlob<T>` carries an optional type hint; it does not decode or validate a blob and is not proof that its contents match `T`. Direct `Wallet.sign` typo rejection remains a known gap.
- The proposed generic `simulate` redesign was removed after review. The method retains published behavior; the prototype makes no improved inference claim for it.
- Five reviewed legacy portal families remain unchanged: claim-payment-channel, get-tx, partial-payment, paths and reliable-tx-submission. The broad original AMM example also remains alongside the new guided journey. The report identifies that remaining work.
- The packed verification covers Node consumers and emitted declarations. No browser bundle was built into that original tarball. A separate browser build passed during the Getting Started follow-up; browser-package compatibility or npm release verification is not claimed. The documentation preview checks are not execution of the browser sample.
- All 18 API families were inventoried, with explicitly bounded static, compiler and runtime probes. The whole SDK has not received exhaustive behavioral, security, cryptographic or performance validation. The xrpl-rust crate and CLI are the proposed next audit phase.
- The portal has a working local preview, not a hosted preview. Hosting needs a compatible Realm deployment setup.

See the [portable reproduction guide](../README.md) for setup and commands, and the [independent prototype review](prototype-review.md) for the decisions that narrowed the implementation.

## Getting Started follow-up

The primary walkthrough now targets the prototype; its published 5.3.0 comparison is retained separately. Five focused editor checks pass, including real Payment field completion. The actual primary `run()` passes a successful payment and correctly rejects `tecUNFUNDED_PAYMENT` on the local ledger. Node/browser TypeScript and the SDK browser bundle build pass. See [follow-up evidence](getting-started-follow-up.md). The original four-journey records remain unchanged snapshots of the earlier revisions.
