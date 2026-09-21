# The integration-test README, CONTRIBUTING, `xrpld.cfg` comments and `getNewAmendments.js` disagree with what CI actually runs

Severity: minor
Category: test-infra

## Affected surface

- `packages/xrpl/test/integration/README.md` (whole file, 10 lines)
- `CONTRIBUTING.md` "Integration Tests" section
- `.ci-config/xrpld.cfg:83-96` (comments above `[features]`)
- `.ci-config/getNewAmendments.js:5`
- `.github/workflows/nodejs.yml:217-224` (the recipe that actually works)

## Repro

Following `packages/xrpl/test/integration/README.md` verbatim:

```
docker run -p 6006:6006 --rm -it --name rippled_standalone --volume $PWD/.ci-config:/etc/opt/ripple/ --entrypoint bash rippleci/rippled:2.3.0-rc1 -c 'rippled -a'
```

- `rippleci/rippled:2.3.0-rc1` predates `DynamicMPT`, `PermissionedDomains`-on-MPT and every
  `fixCleanup*`, so `mptokenIssuanceSet.test.ts` cannot pass on it.
- The mount path `/etc/opt/ripple/` is wrong for the `xrpld` image (it reads `/etc/xrpld/xrpld.cfg`;
  CI mounts `.ci-config/` at `/etc/xrpld/`).
- The README tells you to edit `rippled.cfg` "in the `[amendments]` section" and points at
  `.ci-config/rippled.cfg`; the file is `.ci-config/xrpld.cfg` and the stanza is `[features]`.

`CONTRIBUTING.md` says the mounted directory "contain[s] `xrpld.cfg` and `validators.txt`"; there is
no `validators.txt` in `.ci-config/` (`ls .ci-config` → `getNewAmendments.js xrpld.cfg`).

`.ci-config/getNewAmendments.js:5` reads `path.resolve(__dirname, "./rippled.cfg")`, which does not
exist, so the script fails with `ENOENT` before doing anything.

`.ci-config/xrpld.cfg:83` says "The [features] stanza does not currently work for standalone mode"
while the same file relies on it and CI depends on it working (it does: see
[020](020-feature-rpc-misreports-standalone-presets.md)).

## Expected vs actual

Expected: one recipe, in one place, that a contributor can paste. The working one (verified in this
audit, `audit/README.md` "Local rippled recipe") is CONTRIBUTING's:

```
docker run --detach --publish 6006:6006 --volume "$PWD/.ci-config/:/etc/xrpld/" --name xrpld-service rippleci/xrpld:develop --standalone
```

Actual: three documents give three different recipes; the one in the directory the tests live in is
the wrong one, and the helper script for maintaining the amendment list is broken.

## Root cause

The `rippled` → `xrpld` rename and the switch to the `rippleci/xrpld:develop` image were applied
to CI and CONTRIBUTING but not to the integration README, the config comments, or the helper
script.

## Proposed fix

Docs/test-infra only:

1. Replace `packages/xrpl/test/integration/README.md` with a pointer to CONTRIBUTING plus the
   one-line `docker run` above and `npm run test:integration`.
2. `getNewAmendments.js`: `./rippled.cfg` → `./xrpld.cfg`; also make it print names, not just
   hashes (the `feature` RPC on the devnet node it connects to already returns names).
3. `xrpld.cfg:83`: replace the "does not work" comment with what actually happens: "In standalone
   mode the `[features]` entries are applied as rule presets from genesis; the `feature` RPC will
   still report them as not enabled".
4. CONTRIBUTING: drop `validators.txt` or add the file.

## Workaround today

Use the CONTRIBUTING recipe; ignore the integration README.

## References

- `.github/workflows/nodejs.yml:217-224`
- Related: [020](020-feature-rpc-misreports-standalone-presets.md), [021](021-ci-xrpld-cfg-missing-newer-amendments.md)
