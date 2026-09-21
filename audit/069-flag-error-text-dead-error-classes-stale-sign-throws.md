# Flag-conversion errors name no transaction type and dump a reversed enum; two exported error classes are never thrown; `Wallet.sign`'s `@throws` documents a check deleted in 2023

Severity: paper-cut
Category: runtime

## Affected surface

- `convertTxFlagsToNumber` — `packages/xrpl/src/models/utils/flags.ts:185-204`
- `errors.ts` — `UnexpectedError` (`:69`), `RippledNotInitializedError` (`:97`): zero `new X(`
  sites in `packages/xrpl/src`; `client/index.ts:1232` throws `RippledError('Client not connected,
  cannot call faucet')` where `NotConnectedError` exists for that
- `Wallet.sign` `@throws` — `packages/xrpl/src/Wallet/index.ts:371-372`

## Repro

Offline (`audit/README.md` round-2 log):

```
validate(Clawback Flags {tfMPTLock:true})
  -> ValidationError: Invalid flag tfMPTLock. Valid flags are {"1073741824":"tfInnerBatchTxn","tfInnerBatchTxn":1073741824}
```

(for a type with its own enum the message is just `Invalid flag X.` — no transaction type, no list).

`Wallet.sign` doc (verbatim): "@throws ValidationError if the transaction is already signed or does
not encode/decode to same result. @throws XrplError if the issued currency being signed is XRP
ignoring case." — the encode/decode check was removed in `2442ef14` (#2293, 2023-04-28), and the
XRP-currency check now throws `ValidationError` from `validate()` (`transaction.ts:306`), not
`XrplError`.

## Expected vs actual

Expected: `ValidationError('Clawback: invalid flag "tfMPTLock". Valid flags: tfFullyCanonicalSig')`
(enum reversed entries filtered out); error classes that exist are used or removed; docs match.

Actual: minor noise, but it is the error a developer sees when they confuse the `MPTokenIssuanceSet`
flags with `Clawback` (a realistic mistake given [037](037-mpt-validators-do-not-check-flag-masks.md)).

## Root cause

`JSON.stringify(GlobalFlags)` on a TypeScript numeric enum (which contains reverse mappings); dead
code; stale docs.

## Proposed fix

Non-breaking: include `tx.TransactionType` in the message and list only string keys; throw
`NotConnectedError` at `client/index.ts:1232`; delete or use `UnexpectedError`/
`RippledNotInitializedError`; rewrite the `sign` `@throws` lines to "ValidationError if the
transaction is already signed or fails `validate()`".

## Workaround today

None needed.

## References

- `git show 2442ef14 -- packages/xrpl/src/Wallet/index.ts` (removal of `checkTxSerialization`)
- Related: [037](037-mpt-validators-do-not-check-flag-masks.md), [061](061-lowercase-field-names-silently-dropped-when-signing.md)
