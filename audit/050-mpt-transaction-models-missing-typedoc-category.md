# The five MPT transaction interfaces and `Clawback` carry no `@category Transaction Models` tag, so they drop out of the generated docs' transaction list

Severity: paper-cut
Category: docs

## Affected surface

- `MPTokenIssuanceCreate` — `packages/xrpl/src/models/transactions/MPTokenIssuanceCreate.ts:209-217`
- `MPTokenIssuanceSet` — `MPTokenIssuanceSet.ts:125-129`
- `MPTokenAuthorize` — `MPTokenAuthorize.ts:39-43`
- `MPTokenIssuanceDestroy` — `MPTokenIssuanceDestroy.ts:8-15`
- `Clawback` — `clawback.ts:15-19`
- `packages/xrpl/typedoc.json` (`categoryOrder` includes `"Transaction Models"`, `categorizeByGroup: false`)

## Repro

```
$ grep -n "@category" src/models/transactions/{MPTokenIssuanceCreate,MPTokenIssuanceSet,MPTokenAuthorize,MPTokenIssuanceDestroy,clawback,payment}.ts
MPTokenIssuanceCreate.ts:27:  * @category Transaction Flags
MPTokenIssuanceCreate.ts:75:  * @category Transaction Flags
MPTokenIssuanceCreate.ts:134: * @category Transaction Flags
MPTokenIssuanceSet.ts:35:     * @category Transaction Flags
MPTokenIssuanceSet.ts:98:     * @category Transaction Flags
MPTokenAuthorize.ts:15:       * @category Transaction Flags
MPTokenAuthorize.ts:33:       * @category Transaction Flags
payment.ts:124:               * @category Transaction Models      <-- the pattern the MPT files lack
```

The flag enums are categorised; the transactions they belong to are not.

## Expected vs actual

Expected: on js.xrpl.org, "Transaction Models" lists every submittable transaction; a developer
searching for how to lock or claw back an MPT finds the interfaces there.

Actual: with `categorizeByGroup: false`, untagged interfaces fall into the uncategorised bucket;
the MPT transactions (and `Clawback`) are only reachable via search or via the flag enums.

## Root cause

Tag omitted when the files were added.

## Proposed fix

Add `@category Transaction Models` to the five doc blocks (and `@category Ledger Entries` to
`MPToken`/`MPTokenIssuance`, which `Credential.ts:14` has and they lack).

## Workaround today

Use the site search.

## References

- `packages/xrpl/typedoc.json`
- Related: [031](031-ledger-entry-types-namespaced-undiscoverable.md)
