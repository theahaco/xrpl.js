# `validateMPTokenMetadata` does not check `uris[].category` against the four values the SDK's own `MPTokenMetadataUri` doc lists, while it does enforce an exact three-key rule on each entry

Severity: paper-cut
Category: validation

## Affected surface

- `validateMPTokenMetadata` `uris` rule — `packages/xrpl/src/models/utils/mptokenMetadata.ts:203-259`
  (`isString(category)` only; `Object.keys(uriObj).length !== MPT_META_URI_FIELDS.length` rejects a
  fourth key)
- `MPTokenMetadataUri.category` doc — `packages/xrpl/src/models/common/index.ts:345-351`
  ("Allowed values: website, social, docs, other")

## Repro

Offline:

```ts
validateMPTokenMetadata(encodeMPTokenMetadata({ …required, uris: [{ uri: 'x', category: 'bogus', title: 't' }] }))
// -> []            (no message)
validateMPTokenMetadata(encodeMPTokenMetadata({ …required, uris: [{ uri: 'x', category: 'docs' }] }))
// -> ['uris/us: should be an array of objects each with uri/u, category/c, and title/t properties.']
```

## Expected vs actual

Expected: the advisory validator checks what the type's doc promises (`category ∈ {website, social,
docs, other}`) and tolerates extra keys the way it tolerates extra top-level keys (it only checks
the top-level *count*, `mptokenMetadata.ts:514-520`).

Actual: the rule set and the type's documentation disagree in both directions. Advisory only —
surfaces through the `console.warn` of [027](027-validators-write-to-console.md).

## Root cause

Validator and type written separately.

## Proposed fix

Non-breaking: add `const MPT_META_URI_CATEGORIES = ['website', 'social', 'docs', 'other']` to the
`uris` rule (message on mismatch) and relax the exact-count check to "has the three fields".

## Workaround today

None needed.

## References

- XLS-89 §uris
- Related: [027](027-validators-write-to-console.md)
