# `ConfidentialMPTClawback.MPTAmount` is documented as "the amount being clawed back" while the builder says clawback is all-or-nothing; plain `Clawback` and `tfMPTSetCanHoldConfidentialBalance` never say a confidential balance is out of `Clawback`'s reach

Severity: paper-cut
Category: docs

## Affected surface

- `ConfidentialMPTClawback.MPTAmount` doc — `packages/xrpl/src/models/transactions/ConfidentialMPTClawback.ts:30-33`
  ("The MPT amount being clawed back from the holder.")
- `ConfidentialClawbackParams.amount` doc — `packages/xrpl/src/confidential/types.ts:137-146`
  ("Confidential clawback is all-or-nothing: rippled always burns the holder's entire confidential
  balance … a smaller value does not claw back a partial amount, it just produces a proof rippled
  rejects (tecBAD_PROOF)")
- `Clawback` docs — `clawback.ts:15-18, 26-31` (silent on transparent vs confidential balance)
- `MPTokenIssuanceSetFlags.tfMPTSetCanHoldConfidentialBalance` doc — `MPTokenIssuanceSet.ts:71-75`
  (does not mention the consequence for `Clawback`)

## Repro

Read the two doc blocks above side by side. The transaction model says "amount"; the builder for
the same transaction says "must equal the full balance or the proof is rejected".

## Expected vs actual

Expected: one statement, on the model field: "Must equal the holder's entire confidential balance
(all-or-nothing); the ZK proof binds it to the issuer-encrypted balance." And on `Clawback` /
`tfMPTSetCanHoldConfidentialBalance`: "`Clawback` reaches only the transparent `MPTAmount`; a
confidential balance can only be recovered with `ConfidentialMPTClawback`, which burns all of it
and requires the issuer's registered encryption key."

Actual: a compliance issuer that leaves `tfMPTCanHoldConfidentialBalance` on (this audit pins it
off, `mpt-issuer/src/issue.ts`) learns from neither doc that its clawback tooling must fork into
two paths with different semantics.

## Root cause

Model docs written before the builder's behaviour was pinned down.

## Proposed fix

Docs only, text above.

## Workaround today

Pin `tifMPTCanHoldConfidentialBalance` at create time, as the issuer project does.

## References

- XLS-96 (Confidential MPT) §ConfidentialMPTClawback
- Related: [029](029-protocol-behaviours-sdk-is-silent-about.md), [052](052-cantrade-docs-promise-dex-amm-the-sdk-cannot-express.md)
