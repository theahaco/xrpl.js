# The `maxFeeXRP` cap bypass for reserve-priced transactions looks only at the outer `TransactionType`, so a `Batch` containing an `AccountDelete` / `AMMCreate` / `VaultCreate` is capped below the fee the SDK itself computes

Severity: minor
Category: runtime

## Affected surface

- `calculateFeePerTransactionType` — `packages/xrpl/src/sugar/autofill.ts:378-382`
  (`isSpecialTxCost = ['AccountDelete', 'AMMCreate', 'VaultCreate'].includes(tx.TransactionType)`),
  `:394-406` (Batch branch sums inner fees, including an inner's owner-reserve fee),
  `:449-453` (`isSpecialTxCost ? baseFee : BigNumber.min(baseFee, maxFeeDrops)`)
- Same outer-only pattern: `checkAccountDeleteBlockers` (`client/index.ts:708`) and the forced
  `fail_hard` for `AccountDelete` (`sugar/submit.ts:64`, `isAccountDelete` on the outer type)

## Repro

Offline (stubbed client, base fee 10 drops, default `maxFeeXRP` `'2'`, `audit/README.md` round-7 log):

```
reserve_inc 5 XRP (this audit's .ci-config/xrpld.cfg owner_reserve):
  top-level AccountDelete          Fee = 5000000   (uncapped)
  Batch[authorize, AccountDelete]  Fee = 2000000   (capped; uncapped sum would be 5000036)
reserve_inc 0.2 XRP (mainnet today):
  Batch[authorize, AccountDelete]  Fee = 200036    (below the cap; not affected)
```

## Expected vs actual

Expected: the cap bypass applies when the outer *or any inner* transaction is reserve-priced (or
the Batch branch is excluded from the cap the way the special types are), and the AccountDelete
blocker check / `fail_hard` rule look inside batches too.

Actual: on any network whose owner reserve exceeds `maxFeeXRP` (test nets, this audit's node,
or mainnet after a reserve vote) a Batch that winds an account down is under-fed →
`telINSUF_FEE_P`, a `tel*` result that `submitAndWait` polls until expiry
([025](025-submitandwait-three-failure-surfaces-no-result-helper.md)). Not on the issuer's
enforcement path (the audit never batches a reserve-priced type); rippled's acceptance of
`AccountDelete` as an inner transaction was not verified live (XLS-56 forbids only nested
`Batch`).

## Root cause

Batch support was added to the fee calculator without revisiting the special-cost list.

## Proposed fix

Non-breaking:

```ts
const specialTypes = ['AccountDelete', 'AMMCreate', 'VaultCreate']
const isSpecialTxCost = specialTypes.includes(tx.TransactionType) ||
  (tx.TransactionType === 'Batch' && tx.RawTransactions.some((r) => specialTypes.includes(r.RawTransaction.TransactionType)))
```

and apply the same "or any inner" rule to `checkAccountDeleteBlockers` and `isAccountDelete`.

## Workaround today

Raise `maxFeeXRP` in `ClientOptions` or set `Fee` by hand on such batches.

## References

- Related: [091](091-batch-fee-ignores-batchsigners-signerscount-doc-wrong.md), [067](067-accountdelete-blocker-message-and-reserve-error-class.md), [025](025-submitandwait-three-failure-surfaces-no-result-helper.md)
