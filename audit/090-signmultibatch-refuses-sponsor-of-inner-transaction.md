# `signMultiBatch` refuses to sign for the sponsor of an inner transaction, although the SDK's own validator says the sponsor's authorization must come from a `BatchSigners` entry

Severity: minor
Category: runtime

## Affected surface

- `signMultiBatch` — `packages/xrpl/src/Wallet/batchSigner.ts:100-118` (`involvedAccounts` built from
  `RawTransaction.Delegate ?? Account` and `Counterparty` only, then
  `throw new ValidationError('Must be signing for an address submitting a transaction in the Batch.')`)
- `isSponsorSignature` doc — `packages/xrpl/src/models/transactions/common.ts:117-126`: "rippled's
  Batch::preflight requires a sponsored inner txn's SponsorSignature to carry the same empty
  placeholder shape … the sponsor's real authorization is supplied via a BatchSigners entry on
  the outer Batch transaction."

## Repro

Offline (`audit/README.md` round-3 log): outer `Account` = ops key; inner = holder's
`MPTokenAuthorize` opt-in with `Sponsor: issuer, SponsorFlags: spfSponsorReserve,
SponsorSignature: { SigningPubKey: '' }`:

```
validate(batch with reserve-sponsored inner)   -> ok
signMultiBatch(holder)                          -> ok
signMultiBatch(sponsor = issuer)                -> ValidationError: Must be signing for an address submitting a transaction in the Batch.
```

## Expected vs actual

Expected: the issuer sponsoring holders' `MPToken` reserves (the mitigation for the pinned-reserve
problem in [029](029-protocol-behaviours-sdk-is-silent-about.md) item 8 and
[028](028-pre-emptive-ban-not-expressible-on-ledger.md)) can add its `BatchSigner` with the
function made for that.

Actual: the SDK's validator and its signer disagree about who may sign a batch; the sponsored
onboarding batch has no supported signing path unless the sponsor is also the outer `Account`, or
the developer hand-rolls `encodeForSigningBatch` + a `BatchSigner` object. The on-ledger rule is
taken from the SDK's own comment and XLS-56 ("every account that authorizes an inner transaction
signs the batch"); it was not exercised live in this audit (a sponsored batch needs a full
sponsorship setup).

## Root cause

`involvedAccounts` was not extended when sponsorship landed.

## Proposed fix

Non-breaking:

```diff
   const involvedAccounts = transaction.RawTransactions.flatMap((raw) => [
     raw.RawTransaction.Delegate ?? raw.RawTransaction.Account,
+    raw.RawTransaction.Sponsor,
     …Counterparty…
-  ])
+  ].filter((a): a is string => a != null))
```

## Workaround today

Make the sponsor the outer `Account`, or build the `BatchSigner` manually with
`encodeForSigningBatch`.

## References

- XLS-56 (Batch) §BatchSigners; XLS-68 (Sponsorship)
- Related: [028](028-pre-emptive-ban-not-expressible-on-ledger.md), [088](088-batch-outcome-silent-no-inner-results.md)
