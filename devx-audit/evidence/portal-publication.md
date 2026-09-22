# Portal fork publication

- Repository: [theahaco/xrpl-dev-portal](https://github.com/theahaco/xrpl-dev-portal)
- Draft PR: [Improve TypeScript journeys and compare DevX SDK #1](https://github.com/theahaco/xrpl-dev-portal/pull/1)
- Branch: [aha/devx-audit-2026-09](https://github.com/theahaco/xrpl-dev-portal/tree/aha/devx-audit-2026-09)
- Published head: [`a958b33fcee5915abc147c9c61fc15b8df03db0d`](https://github.com/theahaco/xrpl-dev-portal/commit/a958b33fcee5915abc147c9c61fc15b8df03db0d)
- Base: `master` in the same aha fork. Verified OPEN and draft. No upstream PR was created.
- Commit: `docs: improve TypeScript developer journeys`

## Final verification

Immediately before committing, TypeScript 5.9.3 completed all five project checks successfully: Get Started (Node/browser), current-release MPT, current-release Send XRP, current-release guided AMM, and the separate four-workflow prototype package. `git diff --check` passed. The isolated portal checkout is clean after publication.

Root integration evidence records four successful current-release workflows and four successful prototype workflows on an isolated rippled 3.4.0-rc1 ledger with relevant amendments enabled, using Node 25.9.0. These results do not claim public-faucet execution or browser execution of the SDK example.

Local Realm preview remains available at http://127.0.0.1:4400. Realm 0.135.2 built 2,626 pages without errors, and four edited tutorial routes were checked in a browser. Remote hosting remains conditional; no hosting credentials or infrastructure were configured.

Final publication review corrected the current-release tutorial's `satisfies Payment` claim: on 5.3.0 it checks required fields and known field types but does not reject arbitrary extra-field typos. Links to new source files use the verified `theahaco` owner and published branch.

The original checkout `/Users/willem/c/theahaco/xrpl-dev-portal` was not edited. Its pre-existing modified AMM helper and untracked TypeScript work remain intact; all audit edits and git publication actions took place in the isolated clone.
