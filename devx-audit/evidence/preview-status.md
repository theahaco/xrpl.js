# Portal preview verification

Date: 2026-09-22. Portal source: isolated clone `audit/worktrees/xrpl-dev-portal`, baseline commit `87b3007547539741d99425f43a0796802c834fc3` plus audit changes. Realm version: 0.135.2.

## Local preview: working

Server: http://127.0.0.1:4400

Start from the isolated portal clone:

```sh
node_modules/.bin/realm develop --port 4400
```

The local preview was verified during the audit. Start it with the command above when reviewing this checkout.

Build output reported:

```text
JavaScript compiled
File system scan completed
Search indexes created
Semantic search documents prepared
llms.txt: files generated
Status: No errors found
Total pages: 2626
Watching for changes...
Preview URL: http://127.0.0.1:4400
```

Three existing warnings concern index routes with no sidebar at `docs/use-cases/defi/index.md`, `@l10n/ja/docs/use-cases/defi/index.md`, and `@l10n/es-ES/docs/use-cases/defi/index.md`.

## Browser checks

Inspected rendered pages in the in-app browser using its accessibility tree; screenshots were also inspected for the Get Started and MPT pages. These were documentation checks, not execution of the browser code sample.

- http://127.0.0.1:4400/docs/tutorials/get-started/get-started-typescript — correct 5.3.0 copy, Node walkthrough, live source preview, package scripts and zero-error development indicator. Source panel shows satisfies, checked result and finally cleanup.
- http://127.0.0.1:4400/docs/tutorials/tokens/mpts/issue-a-multi-purpose-token#typescript-walkthrough — new section, correct version, metadata guidance and full TS snippet rendered.
- http://127.0.0.1:4400/docs/tutorials/payments/send-xrp#typescript-walkthrough — new section and current-release autofill workaround visible.
- http://127.0.0.1:4400/docs/tutorials/defi/dex/create-an-automated-market-maker#typescript-walkthrough — new guided TypeScript section and pinned version visible.

All 66 code-snippet paths across the four edited tutorials exist. All Get Started source chunk tags correspond to walkthrough steps. `portal-docs-reference-check.json` records those checks.

The first preview attempt used the original Realm executable, which tried to write its own esbuild cache and was denied. The working preview copies Realm into the isolated clone. Other dependencies are read-only links; xrpl and TypeScript resolve to the audit harness's pinned versions. No source or dependency file in the original portal checkout was changed.

## Hosted preview feasibility

The installed Realm CLI exposes `build` and `serve`. Inspection of `dist/cli/build/index.js` and `dist/server/utils/static-data.js` shows a compiled client/server bundle, route `static-data/*.json`, server store serialization and runtime database migrations. The inspected build path does not produce a portable per-route HTML-only export. A generic static-file upload therefore cannot be assumed to serve this portal correctly.

A hosted preview would need an existing Realm deployment or a compatible Node runtime and deployment configuration. None was configured or authenticated during this bounded check. The local preview is working; remote hosting remains conditional on choosing that infrastructure. No cloud credentials, DNS, remote hosting project, or public URL were created.
