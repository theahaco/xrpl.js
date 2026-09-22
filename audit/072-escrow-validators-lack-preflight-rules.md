# `validateEscrowCreate` / `validateEscrowFinish` miss the preflight rules a token escrow hits (`CancelAfter <= FinishAfter`, zero amount, `Condition` without `Fulfillment`)

Severity: minor
Category: validation

## Affected surface

- `validateEscrowCreate` — `packages/xrpl/src/models/transactions/escrowCreate.ts:61-91`
- `validateEscrowFinish` — `packages/xrpl/src/models/transactions/escrowFinish.ts:49-80`

## Repro

Live via `simulate` (rippled 3.4.0-rc1, `audit/README.md` round-2 log) on an MPT escrow; every
case passes `validate()`:

```
EscrowCreate MPT FinishAfter only (no CancelAfter)   -> tesSUCCESS          (allowed; not a rule)
EscrowCreate CancelAfter == FinishAfter              -> temBAD_EXPIRATION   <-- SDK could catch
EscrowCreate MPT value 0                             -> temBAD_AMOUNT       <-- SDK could catch
EscrowFinish Condition without Fulfillment           -> temMALFORMED        <-- SDK could catch
```

Offline: `Condition: 'zz'` and non-hex `Fulfillment` also pass.

## Expected vs actual

Expected: the rules that need no ledger state are client-side `ValidationError`s: `CancelAfter`
must be strictly after `FinishAfter` when both are present; the amount must be positive (MPT
`value` > 0, [016](016-mpt-amount-value-not-validated-no-scale-helper.md)); `Condition` and
`Fulfillment` must be supplied together on `EscrowFinish` and be hex.

Actual: none are checked; the escrow validators were written for XRP and extended for token amounts
only in their types. (`tfMPTCanEscrow` issuers — this audit pins it off — get the same thin
validation the MPT payment path has, [041](041-payment-validator-lacks-mpt-rules.md).)

## Root cause

Validators predate XLS-85 and were never revisited.

## Proposed fix

Non-breaking:

```ts
if (tx.CancelAfter !== undefined && tx.FinishAfter !== undefined && tx.CancelAfter <= tx.FinishAfter)
  throw new ValidationError('EscrowCreate: CancelAfter must be after FinishAfter')
if (isMPTAmount(tx.Amount) && BigInt(tx.Amount.value) === 0n)
  throw new ValidationError('EscrowCreate: Amount must be positive')
// EscrowFinish
if ((tx.Condition === undefined) !== (tx.Fulfillment === undefined))
  throw new ValidationError('EscrowFinish: Condition and Fulfillment must be provided together')
validateOptionalField(tx, 'Condition', isHex); validateOptionalField(tx, 'Fulfillment', isHex)
```

## Workaround today

Application-level checks.

## References

- rippled `EscrowCreate::preflight`, `EscrowFinish::preflight`; XLS-85
- Related: [016](016-mpt-amount-value-not-validated-no-scale-helper.md), [041](041-payment-validator-lacks-mpt-rules.md), [056](056-escrow-ledger-type-amount-string-issuernode-number.md)
