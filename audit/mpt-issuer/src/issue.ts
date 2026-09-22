/**
 * `issue`: create the compliance token.
 *
 * Flags: tfMPTCanLock | tfMPTRequireAuth | tfMPTCanClawback | tfMPTCanTransfer.
 * ImmutableFlags pin the capabilities we never want turned on later
 * (trade / escrow / confidential balances) and, for documentation value, the
 * safety flags themselves. See audit/README.md "Design mapping" for why.
 */
import {
  MPTokenIssuanceCreate,
  MPTokenIssuanceCreateImmutableFlags,
  MPTokenMetadata,
  Wallet,
  encodeMPTokenMetadata,
  parseMPTokenIssuanceFlags,
  parseMPTokenIssuanceImmutableFlags,
} from 'xrpl'

import { deriveMPTokenIssuanceID } from './ids'
import { getIssuance } from './inspect'
import { Session, fundWallet, openSession } from './session'
import { submitOk } from './tx'

export interface Issued {
  issuer: Wallet
  /** From `meta.mpt_issuance_id` (what the SDK gives you). */
  issuanceId: string
  /** From issuer address + autofilled Sequence (what the SDK does not help you with). */
  derivedIssuanceId: string
  createTx: MPTokenIssuanceCreate
}

export const ASSET_SCALE = 2

export function buildMetadata(): MPTokenMetadata {
  return {
    ticker: 'AUDIT',
    name: 'xrpl.js MPT audit token',
    desc: 'Clawback-able, lockable, allow-listed token used as executable evidence for the SDK audit.',
    icon: 'example.org/audit.png',
    asset_class: 'other',
    issuer_name: 'MPT audit issuer',
  }
}

/* eslint-disable no-bitwise -- flag masks */
/**
 * Capabilities that must never be switched on later. Under XLS-94D every
 * `lsfMPT*` capability is mutable-by-default, but only in the ON direction
 * (`tfMPTSet*` are one-way), so `ImmutableFlags` is the only way to promise
 * holders the token will *not* become tradable/escrowable/confidential.
 */
export const PINNED_OFF =
  MPTokenIssuanceCreateImmutableFlags.tifMPTCanTrade |
  MPTokenIssuanceCreateImmutableFlags.tifMPTCanEscrow |
  MPTokenIssuanceCreateImmutableFlags.tifMPTCanHoldConfidentialBalance

/** Safety flags we set at create time; pinning them is cosmetic (one-way already) but documents intent. */
export const PINNED_ON =
  MPTokenIssuanceCreateImmutableFlags.tifMPTCanLock |
  MPTokenIssuanceCreateImmutableFlags.tifMPTRequireAuth |
  MPTokenIssuanceCreateImmutableFlags.tifMPTCanClawback
/* eslint-enable no-bitwise */

export function buildCreateTx(issuer: string, opts: { pinFlags?: boolean } = {}): MPTokenIssuanceCreate {
  const tx: MPTokenIssuanceCreate = {
    TransactionType: 'MPTokenIssuanceCreate',
    Account: issuer,
    AssetScale: ASSET_SCALE,
    MaximumAmount: '100000000000',
    MPTokenMetadata: encodeMPTokenMetadata(buildMetadata()),
    Flags: {
      tfMPTCanLock: true,
      tfMPTRequireAuth: true,
      tfMPTCanClawback: true,
      tfMPTCanTransfer: true,
    },
  }
  if (opts.pinFlags ?? true) {
    // eslint-disable-next-line no-bitwise
    tx.ImmutableFlags = PINNED_OFF | PINNED_ON
  }
  return tx
}

export async function issueToken(session: Session, opts: { pinFlags?: boolean; issuer?: Wallet } = {}): Promise<Issued> {
  const issuer = opts.issuer ?? (await fundWallet(session))
  const tx = buildCreateTx(issuer.classicAddress, opts)

  // Autofill first so we can derive the ID from the Sequence rippled will use.
  const filled = await session.client.autofill(tx)
  // AUDIT-033: `autofill` returns the same `T`, so `Sequence` stays optional in
  // the type even though autofill just populated it; a guard (or `!`) is forced.
  if (filled.Sequence === undefined) {
    throw new Error('autofill did not populate Sequence')
  }
  const derivedIssuanceId = deriveMPTokenIssuanceID(issuer.classicAddress, filled.Sequence)

  const applied = await submitOk(session.client, filled, issuer)

  // AUDIT-012: `mpt_issuance_id` is optional on MPTokenIssuanceCreateMetadata.
  // It is always present on tesSUCCESS, but the type cannot say so, so every
  // caller writes `!` (the repo's own tests do) or a guard like this one.
  const issuanceId = applied.meta.mpt_issuance_id
  if (issuanceId === undefined) {
    throw new Error('tesSUCCESS MPTokenIssuanceCreate without mpt_issuance_id')
  }
  if (issuanceId !== derivedIssuanceId) {
    throw new Error(`derived ID ${derivedIssuanceId} != meta ID ${issuanceId}`)
  }
  return { issuer, issuanceId, derivedIssuanceId, createTx: tx }
}

async function main(): Promise<void> {
  const session = await openSession()
  try {
    const issued = await issueToken(session)
    const issuance = await getIssuance(session.client, issued.issuanceId)
    // eslint-disable-next-line no-console
    console.log({
      issuer: issued.issuer.classicAddress,
      issuanceId: issued.issuanceId,
      derivedMatches: issued.issuanceId === issued.derivedIssuanceId,
      ledgerFlags: parseMPTokenIssuanceFlags(issuance.Flags),
      ledgerImmutableFlags: parseMPTokenIssuanceImmutableFlags(issuance.ImmutableFlags),
      rawEntry: issuance,
    })
  } finally {
    await session.close()
  }
}

if (require.main === module) {
  main().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error(err)
    process.exitCode = 1
  })
}
