# xrpl.js DevX audit — aha company

This package combines the audit findings, a before/after developer walkthrough, a bounded SDK prototype and reproducible evidence. The published comparison target is **xrpl 5.3.0**; the aha prototype identifies itself as **5.3.0-aha.devx.0**. Work is intended for the aha forks. The xrpl-rust crate and CLI are the next proposed phase.

Start with the [report](output/report.pdf) ([editable source](output/report.md)), then the [walkthrough deck](output/xrpl-devx-walkthrough.pptx). The [validation summary](evidence/validation-summary.md) explains what was checked and the remaining limits. The [finding register](evidence/finding-register.md), [public API coverage](evidence/api-coverage.md) and [portal review](evidence/portal-review.md) provide the supporting detail.

The inventory contains **447 root exports in 18 families**, and seven existing portal TypeScript families were reviewed. In the deliberately selected compiler demonstration, the published baseline meets **3/16 criteria** and the prototype meets **16/16**. This is a demonstration set, not a quality score for the whole library. The latest xrpl unit run passed **141 suites and 1,404 tests**. The wallet-builder follow-up passes **25/25 editor checks** covering **78 transaction factories and 45 commands**; changed-file lint has zero errors and 16 style warnings. Four revised example journeys ran on each SDK target; the four current prototype journeys and matched validated-failure paths were rerun after the API change. See the [evidence summary](evidence/validation-summary.md) for exact scope and links.

## Package layout

The commands below assume these sibling checkouts, with this directory delivered inside the SDK fork:

```text
parent/
  xrpl.js/
    packages/xrpl/
    devx-audit/
      README.md
      output/
      evidence/
      harness/
  xrpl-dev-portal/
    _code-samples/
```

Evidence records preserve the original audit paths, timestamps, hashes and package versions. Paths such as `audit/worktrees/...` in historical logs describe the audit environment; they are not prerequisites for these commands. Rerunning a harness writes the corresponding result files in `devx-audit/evidence/`, so use a separate checkout if you want to preserve the delivered results unchanged.

## Build and compiler checks

Use the repositories' supported Node/npm versions; the SDK manifest requires Node 20.19 or later. The consumer harness pins TypeScript 5.9.3, `@types/node` 22.18.6 and published xrpl 5.3.0 in its lockfile. The prototype uses const type parameters and therefore requires TypeScript 5.0 or later; older compilers are not supported by these prototype declarations.

From the `xrpl.js` repository root, install the SDK's workspace dependencies and build its library declarations:

```sh
npm install
node node_modules/typescript/bin/tsc -b packages/xrpl/tsconfig.build.json
git diff --check
```

From `xrpl.js/devx-audit/harness`, install the pinned baseline and run the inventory, compiler and offline probes:

```sh
npm ci
node inventory-public-api.cjs
node inventory-surface-probes.cjs
node inventory-runtime-probes.cjs
node probe-journeys.mjs baseline
node probe-journeys.mjs prototype ../../packages/xrpl/dist/npm/index.d.ts
node inventory-surface-probes.cjs ../../packages/xrpl/dist/npm/index.d.ts prototype
node probe-builders.cjs
```

The inventory targets the installed published package. Surface probes record both accepted and rejected examples; their diagnostic counts are observations, not a pass/fail total. The journey harness checks the declared expectation for each selected case. None of these commands sends transactions to a public network.

To reproduce the complete package unit suite, run from `xrpl.js/packages/xrpl`:

```sh
node ../../node_modules/jest/bin/jest.js --config jest.config.unit.js --runInBand --coverage=false
```

The suite needs permission to bind local mock WebSocket servers. To lint the same 59 SDK files recorded in the audit, run this from `xrpl.js`:

```sh
node --input-type=module <<'NODE'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
const recorded = JSON.parse(fs.readFileSync('devx-audit/evidence/prototype-lint.json', 'utf8'))
const files = recorded.map(({ filePath }) => filePath.split('/packages/xrpl/')[1])
const result = spawnSync(process.execPath, ['../../node_modules/eslint/bin/eslint.js', ...files], { cwd: 'packages/xrpl', stdio: 'inherit' })
process.exit(result.status ?? 1)
NODE
```

## Compile the example journeys

Three revised public examples target published 5.3.0. The main Getting Started example now presents the proposed SDK experience, while its retained 5.3.0 comparison lives in `devx-before/get-started`. The parallel `devx-after` examples target the built sibling SDK fork. From `xrpl.js`:

```sh
for sample in devx-before/get-started get-started/ts send-xrp/ts issue-mpt-with-metadata/ts create-amm/ts devx-after; do
  npm --prefix "../xrpl-dev-portal/_code-samples/$sample" install
  npm --prefix "../xrpl-dev-portal/_code-samples/$sample" run build
done
```

The AMM build compiles the guided example; it does not replace the broad original. The seven-family review includes five other legacy families whose fixes remain outstanding. See [portal coverage](evidence/portal-coverage.json) for the distinction between reviewed, revised and executed examples.

## Run against the isolated ledger

The recorded runs used standalone rippled **3.4.0-rc1** from the image digest below. Docker must be running, and ports 15005/16006 must be available. From `xrpl.js/devx-audit/harness`, create a fresh disposable ledger with the supplied configuration:

```sh
docker run -d --name aha-devx-audit-reproduction \
  -p 127.0.0.1:16006:6006 -p 127.0.0.1:15005:5005 \
  -v "$PWD/docker/rippled.cfg:/etc/opt/ripple/rippled.cfg:ro" \
  --entrypoint /usr/bin/xrpld \
  rippleci/xrpld@sha256:898feb090a777fddce725b6e4af776194bbead943a02e8cc80b4b0c4556d2a52 \
  --standalone --start --conf /etc/opt/ripple/rippled.cfg
```

The supplied `[amendments]` configuration and fresh-genesis `--start` flag establish the fixture; no separate feature-enabling command is required. [Active-feature evidence](evidence/local-ledger-active-features.json) records the actual running state, including enabled DynamicMPT, AMM and MPTokensV1. Some configured IDs are not reported active, so the configuration list should not be read as the observed state. [The earlier feature inventory](evidence/local-ledger-features.json) records available/supported features before the run. Neither file establishes public-network amendment availability. After the server is ready, run from the same harness directory:

```sh
node run-local-journeys.mjs '' baseline
node run-local-journeys.mjs ../../packages/xrpl/dist/npm/index.js prototype after
node run-local-negative-outcomes.mjs
```

The harnesses fund fresh accounts from the public deterministic standalone genesis account, advance local ledgers and execute Get Started, Send XRP, MPT metadata issuance and guided AMM creation. The negative run checks that the Send XRP example rejects a validated `tecUNFUNDED_PAYMENT`, with only the sender's fee charged. These are real transactions on the isolated fixture; no public faucet or production account is used.

The default endpoint is `ws://127.0.0.1:16006`. Set `XRPL_AUDIT_ENDPOINT` to another isolated fixture endpoint or `XRPL_PORTAL_PATH` to an absolute portal checkout path when needed. These scripts require the standalone admin methods and are not public-network scripts. Stop the container created above when finished:

```sh
docker stop aha-devx-audit-reproduction
```

## Local docs preview and packed-consumer evidence

From the sibling `xrpl-dev-portal` root, install its dependencies using that repository's setup, then start its pinned Realm preview:

```sh
node_modules/.bin/realm develop --port 4400
```

The audit inspected four rendered tutorial pages and checked 66 snippet references. [Preview evidence](evidence/preview-status.md) records the result. This is a local preview; no hosted deployment is included.

[Package verification](evidence/package-verification.json) records the prototype tarball hash, 16/16 selected consumer criteria and restored hover descriptions. This checked Node/declaration consumption after `npm pack --ignore-scripts`; the tarball did not contain browser bundles. To rerun the selected checks against an extracted tarball with its dependencies installed, use its absolute declaration path as the candidate:

```sh
node probe-journeys.mjs packed /absolute/path/to/extracted/package/dist/npm/index.d.ts
node inventory-surface-probes.cjs /absolute/path/to/extracted/package/dist/npm/index.d.ts packed
```

Before release, review the changed `submitAndWait` failure contract, wallet-bound builders, explicit API v2 confirmation lookup, TypeScript minimum version, optional signed-blob type hint and remaining inference gaps. The [validation summary](evidence/validation-summary.md) explains these limits, the unchanged `simulate` behavior and the remaining legacy example work.

## Wallet-bound workflow follow-up

The main Node/browser walkthrough now uses `WalletClient`, `client.tx.payment(...).signAndSubmit()` and `client.command.accountInfo(...)`. Normal submission throws on failure; the `try` methods return an explicit success/error result. See [current verification and migration notes](evidence/builders-follow-up.md). Earlier Getting Started and packed-package records remain historical snapshots.
