# On the CI standalone node the `feature` RPC reports every amendment as disabled and vetoed, and the integration `isAmendmentEnabled` helper (unused) would return `false` for amendments that are in effect

Severity: minor
Category: test-infra

## Affected surface

- `isAmendmentEnabled` — `packages/xrpl/test/integration/utils.ts:100-124` (defined; zero call sites:
  `grep -rn isAmendmentEnabled packages/xrpl/test | grep -v utils.ts` is empty)
- `.ci-config/xrpld.cfg` `[features]` stanza + the comment at line 83
- Anything that would gate tests on `feature` (none today, which is why CI passes)

## Repro

`npm run check-amendments` in `audit/mpt-issuer` (rippled 3.4.0-rc1, CI recipe):

```
Behavioural probe (simulate → engine_result):
  IN EFFECT  MPTokensV1                                  tesSUCCESS
  IN EFFECT  DynamicMPT (MPTokenIssuanceSet mutation)    tecOBJECT_NOT_FOUND
  IN EFFECT  Clawback (MPT amount)                       terNO_ACCOUNT
  IN EFFECT  PermissionedDomains                         tesSUCCESS
  IN EFFECT  Credentials                                 tecNO_TARGET

`feature` RPC view of the same amendments:
  MPTokensV1               enabled=false vetoed=true
  DynamicMPT               enabled=false vetoed=true
  Clawback                 enabled=false vetoed=Obsolete
  PermissionedDomains      enabled=false vetoed=true
  Credentials              enabled=false vetoed=true
```

The Amendments ledger object (`7DB0788C…6EF4`) does not exist on that node at all (`entryNotFound`),
and `rippled --standalone --start` seeds genesis with only the two default-yes amendments. Yet the
repo's `mptokenIssuanceSet.test.ts` passes against it.

## Expected vs actual

Expected: a way to ask the node "is amendment X in effect for transaction processing?" that agrees
with what `simulate`/`submit` do, and test helpers that use it.

Actual: in standalone mode rippled applies the `[features]` list as *rule presets* (they gate
transactors from genesis) without ever writing them to the Amendments object, and the `feature`
RPC only reads that object. So `feature` says "disabled, vetoed" for everything while transactions
behave as if enabled. The cfg comment ("does not currently work for standalone mode") records the
symptom, not the cause. `isAmendmentEnabled` in the test utils implements exactly the wrong probe;
it is dead code today, but the first test that uses it to skip on missing amendments will skip on
CI forever.

## Root cause

rippled: `Rules` are built from `config.features` presets ∪ ledger amendments; `feature` reports
only the latter. Test utils: written against a networked node.

## Proposed fix

Test-infra only:

1. Replace `isAmendmentEnabled` with a behavioural probe (the `simulate`-based
   `probeAmendments` in `audit/mpt-issuer/src/check-amendments.ts` is a drop-in: submit a gated
   transaction via `simulate` and treat `temDISABLED` as "off").
2. Or, in CI, start the node with `--standalone --start` **and** list the same amendments under
   `[amendments]`/as genesis amendments so the ledger object exists; then `feature` is truthful.
   (With `--start`, only amendments the node votes *up* are seeded; the `[features]` presets do
   not count as up-votes, so this needs `[amendments]` entries too.)
3. Fix the comment in `xrpld.cfg:83`.

## Workaround today

Trust behaviour, not `feature`, on standalone nodes.

## References

- rippled `Rules::isEnabled` (presets checked before the ledger amendment set); `Config::features`
- `.ci-config/xrpld.cfg:83` (link to xrpl-dev-portal issue #1762 comment)
- Related: [019](019-integration-test-docs-stale.md), [021](021-ci-xrpld-cfg-missing-newer-amendments.md), [032](032-feature-response-lacks-vetoed-and-vote-fields.md)
