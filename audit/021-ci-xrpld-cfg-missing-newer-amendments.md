# The CI `xrpld.cfg` `[features]` list omits 11 amendments the `develop` image supports, including `fixMPTDeliveredAmount`, so integration tests run a ruleset that differs from what mainnet will enable

Severity: minor
Category: test-infra

## Affected surface

- `.ci-config/xrpld.cfg:97-186` (`[features]` stanza, 91 entries, last group "3.4.0 Amendments")
- Every integration test, in particular the MPT `Payment` tests (`payment.test.ts:118-201`) and the
  `delivered_amount` typing in `packages/xrpl/src/models/transactions/metadata.ts:86-88`

## Repro

Computed against the running CI image (rippled 3.4.0-rc1) by diffing the `feature` RPC's
`supported` set against the stanza (`audit/mpt-issuer` one-off script; output verbatim):

```
listed in cfg: 91 | supported by rippled: 107
supported but NOT in cfg [features]: 16
CryptoConditionsSuite (Obsolete)
NonFungibleTokensV1_1 (Obsolete)
fixAMMClawbackRounding
fixAMMv1_3
fixCleanup3_5_0
fixDirectoryLimit
fixDisallowIncomingV1 (Obsolete)
fixEnforceNFTokenTrustlineV2
fixFillOrKill
fixIncludeKeyletFields
fixMPTDeliveredAmount
fixNFTokenRemint (Obsolete)
fixNonFungibleTokensV1_2 (Obsolete)
fixPayChanCancelAfter
fixPriceOracleOrder
fixTokenEscrowV1
```

Five are obsolete (never to be enabled) and correctly absent; the other eleven are real
amendments the tests never exercise. Because `[features]` entries act as presets
([020](020-feature-rpc-misreports-standalone-presets.md)), each omission means "off".

## Expected vs actual

Expected: the CI ruleset tracks the image. `fixMPTDeliveredAmount` in particular changes what
`meta.delivered_amount` / `DeliveredAmount` contain for MPT payments — exactly the field the SDK
types as `Amount | MPTAmount | 'unavailable'` and that `handlePartialPayment`
(`client/partialPayment.ts`) inspects. `fixIncludeKeyletFields` changes ledger-entry JSON
(additional key fields), which affects every ledger type in this audit.

Actual: the list stops at "3.4.0 Amendments" while the image is `develop`; there is no check that
the list is complete, and the helper meant to find gaps is broken
([019](019-integration-test-docs-stale.md)).

## Root cause

Manual list, no CI assertion.

## Proposed fix

Test-infra only:

1. Add the eleven amendments to `[features]` (grouped under "3.5.0 / develop").
2. Add a setup step (or a test in `test/integration/setup.ts`) that requests `feature`, computes
   `supported && !obsolete && !listed`, and fails with the missing names. `vetoed === 'Obsolete'`
   is the marker for the ones to ignore (which requires
   [032](032-feature-response-lacks-vetoed-and-vote-fields.md)).
3. Add an MPT `Payment` integration test asserting `delivered_amount` shape with
   `fixMPTDeliveredAmount` on, and update the `PaymentMetadata` docs accordingly.

## Workaround today

Append the names to a local copy of `xrpld.cfg` before `docker run`.

## References

- rippled release notes for 3.5.0 (`fixMPTDeliveredAmount`, `fixCleanup3_5_0`, `fixIncludeKeyletFields`)
- Related: [019](019-integration-test-docs-stale.md), [020](020-feature-rpc-misreports-standalone-presets.md)
