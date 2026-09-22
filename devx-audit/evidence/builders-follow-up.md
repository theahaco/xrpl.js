# Wallet-bound discovery and success handling

This follow-up implements the requested API direction in the unreleased aha prototype. It supersedes the caller-owned success checks in earlier Getting Started evidence.

## Public contract

- `new WalletClient(server, { wallet })` binds a required signing wallet. `Client` also accepts an optional default wallet for lower-level submissions.
- `client.tx` exposes **78** modeled transaction factories with field completion and hover descriptions. Factories supply TransactionType and default Account to the wallet; an explicit Account remains available for regular-key signing. Validator-only pseudo-transactions are excluded.
- A factory creates an independent draft. `.toJSON()` returns a copy. `.signAndSubmit()` prepares, signs, submits and waits for validated success. Merely awaiting the builder does not submit it.
- `client.command` exposes **45** modeled commands on both client classes. Request fields infer their response, including binary and API-version alternatives.
- `submitAndWait` and `.signAndSubmit()` throw `TransactionFailedError` for an unsuccessful validated transaction. The error retains its decoded `response`, hash and engine result.
- `trySubmitAndWait` and `.trySignAndSubmit()` return `{ ok: true, response }` or `{ ok: false, error }`. They also capture signing, validation, transport and expiry errors. Network failures can leave the ledger outcome unknown; an error is not permission to retry blindly.
- Finality polling remains unchanged. Preliminary `tel`/`tef` outcomes are not newly treated as terminal. The SDK classifies the final validated response.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Actual TypeScript editor/compiler | 25/25 checks, including all 78/45 completions, sampled method/field documentation, required fields, inline and stored typos, safe binary/version unions, and `ok` narrowing | [Editor results](builders-editor.json) |
| Complete package unit suite | 141 suites, 1,404 tests pass; none skipped | [Machine results](builders-unit-tests.json), [log](builders-unit-tests.log) |
| Focused runtime | Successful payment, thrown validated failure, successful/failed try results and default wallet signing pass | [Ledger results](builders-runtime.json) |
| Four prototype examples | Getting Started, Send XRP, MPT issuance/update and AMM setup/create/query pass on the isolated ledger | [Journey results](runtime-builders-prototype.json) |
| Matched Send XRP failure | Published 5.3.0 returns the failed response for the example to check; the prototype throws a structured error. Both actual examples reject, receiver balance is unchanged and sender pays only the fee | [Matched results](runtime-negative-outcomes-builders.json) |
| SDK builds | All seven workspaces and separate xrpl browser build pass | [Workspace log](builders-all-workspace-build.log), [browser log](builders-browser-build.log) |
| Changed TypeScript lint | 11 files, zero errors, 16 style warnings | [Lint results](builders-lint.json). Warnings concern internal boundary casts, parameter properties, mapped-type line length and explicit return-type style. |
| Example builds and source references | Node/browser Getting Started and all prototype examples compile; seven referenced files and both chunk sets are consistent | [Main build](builders-getting-started-build.log), [comparison build](builders-portal-examples-build.log), [reference checks](builders-docs-check.json) |
| Prior selected criteria | Prototype still satisfies 16/16 | [Compiler results](journey-prototype.json). The baseline 3/16 is a historical published-package comparison, not an SDK quality score. |

The local ledger is standalone rippled 3.4.0-rc1, using the previously recorded pinned image and configuration. No public-network account or faucet was used. All factory names are tested for dispatch; this does not claim signing/runtime coverage for every modeled transaction or command. Multisigning and amendment-dependent workflows still require their protocol-specific setup.

## Migration and delivery

Changing `submitAndWait` from “validated inclusion” to “validated success” is a **breaking proposal**. Existing failure-inspecting callers must handle a `trySubmitAndWait` result or catch `TransactionFailedError` and inspect its response. Low-level `submit`, raw `request` and `command.submit` retain their protocol response behavior. The API-v2 confirmation and TypeScript-5 minimum remain compatibility decisions from the earlier prototype.

One inherited inference gap remains: `Client.request` uses the mutable client API version at runtime, while absent per-request `api_version` is inferred as the default API version. The new command methods share that behavior. When changing the client API version, supply `api_version` explicitly per request (a literal or a correctly typed union). The version checks above cover explicit request values; they do not establish that inference follows mutable client state. This is a source/type observation and release follow-up, not a claim that all version configurations are solved.

The main Node/browser tutorial now uses builders and command methods. All four prototype examples remove redundant result-code comparisons. Published 5.3.0 comparisons retain their required checks. The six-page report and 13-slide deck reflect this contract and include the wallet/discovery step.

The initial Realm preview was inspected earlier. The revised tutorial has source and compilation checks, but no refreshed browser inspection: the browser tool previously could not verify its access policy. The browser build is not a browser-runtime test. A hosted preview and npm release remain outside the completed work.

To reproduce from `devx-audit/harness` after building the sibling SDK and portal examples:

```sh
node probe-builders.cjs
node verify-getting-started.mjs
node run-local-journeys.mjs ../../packages/xrpl/dist/npm/index.js builders-prototype after
node run-local-negative-outcomes.mjs
```

The last three commands require the disposable standalone ledger described in the reproduction guide. The registry/documentation generator reads source models and can be rerun with `node generate-client-registries.cjs`; format the resulting SDK files with the repository formatter.
