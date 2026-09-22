# Prototype validation

The final local aha-fork prototype passed the xrpl package's complete unit suite: **140 suites, 1,396 tests, zero failures, zero skipped tests**, in 104.931 seconds. These are local unit/mock-server tests, not live-ledger integration, browser or cryptographic audit results.

- [Machine-readable unit results](prototype-unit-results.json)
- [Unit test log](prototype-unit-tests.txt)
- [Changed-file lint results](prototype-lint.json): 59 changed/new TypeScript files, zero errors and zero warnings.
- [Strict package-consumer journey results](journey-prototype.json): 16 of 16 deliberately selected criteria met. This is a demonstration set, not an SDK-wide quality score.
- [Focused type/AMM regression log](prototype-type-regressions.txt): 29 tests across three suites passed before the complete run.

The package build and `git diff --check` also passed after review. The final declaration output was rebuilt and the 16 journey criteria were rechecked against that output.

## Integration corrections exercised

1. Preserve literal request selectors, filters and versions through strict key checking using a const type parameter.
2. Keep response types conservative for broad/optional/binary/version-union requests.
3. Separate JSON and blob submission overloads so valid broad/union transaction inputs continue to compile while direct misspellings are rejected.
4. Replace object Flags with numeric Flags in the autofilled return type; preserve the caller's original draft.
5. Include the documented `ledger_hash` and `ledger_index` options on AMMInfoRequest. The local portal's protocol reference explicitly lists both and demonstrates `ledger_index: 'validated'`.
6. Retain published 5.3 submission classification and polling order. The validated-result refinement uses an API v2 lookup plus explicit validated/parsed-metadata guards. Independent-review regression tests cover that boundary.

The prototype does not include the earlier simulate redesign. Its client method and documentation were restored to the published baseline, and the orphan normalization helper was removed. SignedBlob remains an inference hint, not runtime proof of a blob's contents. Direct `Wallet.sign` typo rejection remains a known limitation; no comprehensive remediation claim is made.

## Reproduction

From the SDK repository root:

```sh
node node_modules/typescript/bin/tsc -b packages/xrpl/tsconfig.build.json
git diff --check
```

From `packages/xrpl` in the SDK repository:

```sh
node ../../node_modules/jest/bin/jest.js --config jest.config.unit.js --runInBand --coverage=false
```

The unit suite opens local mock WebSocket servers. The final run used permission to bind those servers outside the sandbox; an earlier sandbox-only attempt failed on `listen EPERM` and was not reported as a successful verification.

From `devx-audit/harness`:

```sh
node probe-journeys.mjs prototype ../../packages/xrpl/dist/npm/index.d.ts
```
