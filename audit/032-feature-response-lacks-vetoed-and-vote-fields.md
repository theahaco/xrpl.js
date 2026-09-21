# `FeatureAllResponse` / `FeatureOneResponse` type each amendment as `{ enabled, name, supported }` and omit `vetoed`, `count`, `threshold`, `validations`, `vote`

Severity: minor
Category: rpc

## Affected surface

- `FeatureAllResponse`, `FeatureOneResponse` — `packages/xrpl/src/models/methods/feature.ts:23-61`

## Repro

Raw `feature` entry from rippled 3.4.0-rc1 (this audit's setup probe):

```json
"950AE2EA4654E47F04AA8739C0B214E242097E802FD372D24047A89AB1F5EC38": {
  "enabled": false, "name": "MPTokensV1", "supported": true, "vetoed": true
}
"56B241D7A43D40354D02A9DC4C8DF5C7A1F930D92A9035C4E12291B3CA3E1C2B": {
  "enabled": false, "name": "Clawback", "supported": true, "vetoed": "Obsolete"
}
```

```ts
for (const f of Object.values(res.result.features)) f.vetoed
// TS2339: Property 'vetoed' does not exist on type '{ enabled: boolean; name: string; supported: boolean; }'.
```

Compiled repro `repros.ts` (`audit032`); cast at `audit/mpt-issuer/src/check-amendments.ts:97-103`.

## Expected vs actual

Expected: the documented shape — `vetoed: boolean | 'Obsolete'` always, and for amendments not yet
enabled on a networked node `count`, `threshold`, `validations` (numbers) and `vote` (`'yes'`|`'no'`
when the node is a validator); `majority` (ledger index) when a majority is reached.

Actual: three fields. Anything that needs to distinguish "not enabled because obsolete" from "not
enabled, could be" (e.g. the amendment-list audit in
[021](021-ci-xrpld-cfg-missing-newer-amendments.md)) must cast.

## Root cause

Type written from the minimal example.

## Proposed fix

Non-breaking addition:

```ts
interface FeatureInfo {
  enabled: boolean
  name: string
  supported: boolean
  /** true if this server votes against the amendment; "Obsolete" if it can no longer be enabled. */
  vetoed: boolean | 'Obsolete'
  count?: number
  threshold?: number
  validations?: number
  vote?: 'yes' | 'no'
  majority?: number
}
```

used by both responses.

## Workaround today

`(feature as { vetoed?: boolean | string }).vetoed`.

## References

- xrpl.org `feature` method response fields
- Related: [020](020-feature-rpc-misreports-standalone-presets.md)
