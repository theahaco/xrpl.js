# Getting Started: guide through the SDK contract

The main TypeScript tutorial now demonstrates the proposed SDK experience. It passes object literals directly to `request` and `submitAndWait`, so the discriminants guide completion and inference. There are no Payment/AccountInfoRequest imports, redundant `satisfies` clauses, assertions, standalone `validate()` call, or metadata-format guard. The application still checks the actual transaction result.

The Node and browser examples use the local unreleased SDK dependency. The 5.3.0 comparison is preserved at `_code-samples/devx-before/get-started`; runtime harnesses now resolve that path when running the baseline. The duplicate `devx-after` Getting Started module matches the primary Node workflow. The tutorial focuses on the first test payment and removes the optional Mainnet/seed detours.

## Checks

- Node and browser TypeScript compile against the prototype. The retained 5.3.0 comparison and four-workflow `devx-after` package also compile.
- [Five editor checks](getting-started-editor.json) pass. Actual language-service completion offers Amount, Destination and DestinationTag after TransactionType: Payment. Missing Amount and DestinationTagg are rejected; valid input and direct parsed-metadata access compile.
- [Actual main workflow execution](getting-started-runtime.json) passes both a payment and a validated tecUNFUNDED_PAYMENT outcome on isolated rippled 3.4.0-rc1. The failure path reports the result and the recipient balance does not increase.
- The SDK browser build passes after building its mpt-crypto workspace dependency. The local import-map adapter and HTML resolve to that build, rather than the published 5.3.0 CDN package. This is build verification, not browser execution.
- [Tutorial source checks](getting-started-docs-check.json) found seven unique source/config references, all present; every source chunk matches a tutorial step. The primary sources contain none of the removed workarounds.
- The revised report and changed slides were rendered and visually inspected. No SDK source changes were needed; the earlier unit suite remains the validation of that unchanged SDK implementation.

A fresh browser check was attempted, but the browser tool could not verify its admin-enforced access policy and denied access to the local preview. No bypass was attempted. The earlier preview evidence remains valid for the earlier revision; this follow-up does not claim visual verification of the new tutorial page or runtime verification of the browser sample.

## Reproduce

Build the SDK workspaces using the SDK repository instructions. Install/build `_code-samples/get-started/ts`, `_code-samples/devx-before/get-started`, and `_code-samples/devx-after` in the sibling portal checkout. From the audit harness:

```sh
node probe-getting-started.cjs
node verify-getting-started.mjs
```

The runtime check requires the disposable standalone fixture described in the audit README. It never uses a public faucet.
