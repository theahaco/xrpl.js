/**
 * `freeze`: global lock/unlock of the whole issuance and per-holder lock/unlock.
 *
 * Verified by reading `lsfMPTLocked` on the MPTokenIssuance (global) or on the
 * holder's MPToken (per-holder), and by watching a holder payment fail while
 * locked.
 */
import { MPTokenIssuanceSet, MPTokenIssuanceSetFlags, Wallet } from 'xrpl'

import { getMPToken, holderBalance, issuanceFlags, parseMPTokenFlags } from './inspect'
import { issueToken } from './issue'
import { onboardHolder, pay } from './holders'
import { Session, openSession } from './session'
import { submitObserve } from './tx'

export function globalLockTx(issuanceId: string, issuer: string): MPTokenIssuanceSet {
  return {
    TransactionType: 'MPTokenIssuanceSet',
    Account: issuer,
    MPTokenIssuanceID: issuanceId,
    Flags: MPTokenIssuanceSetFlags.tfMPTLock,
  }
}

export function globalUnlockTx(issuanceId: string, issuer: string): MPTokenIssuanceSet {
  return {
    TransactionType: 'MPTokenIssuanceSet',
    Account: issuer,
    MPTokenIssuanceID: issuanceId,
    Flags: MPTokenIssuanceSetFlags.tfMPTUnlock,
  }
}

export function holderLockTx(issuanceId: string, issuer: string, holder: string): MPTokenIssuanceSet {
  return {
    TransactionType: 'MPTokenIssuanceSet',
    Account: issuer,
    MPTokenIssuanceID: issuanceId,
    Holder: holder,
    Flags: MPTokenIssuanceSetFlags.tfMPTLock,
  }
}

export function holderUnlockTx(issuanceId: string, issuer: string, holder: string): MPTokenIssuanceSet {
  return {
    TransactionType: 'MPTokenIssuanceSet',
    Account: issuer,
    MPTokenIssuanceID: issuanceId,
    Holder: holder,
    Flags: MPTokenIssuanceSetFlags.tfMPTUnlock,
  }
}

export async function globalLock(session: Session, issuanceId: string, issuer: Wallet): Promise<string> {
  return submitObserve(session.client, globalLockTx(issuanceId, issuer.classicAddress), issuer)
}

export async function globalUnlock(session: Session, issuanceId: string, issuer: Wallet): Promise<string> {
  return submitObserve(session.client, globalUnlockTx(issuanceId, issuer.classicAddress), issuer)
}

export async function holderLock(session: Session, issuanceId: string, issuer: Wallet, holder: string): Promise<string> {
  return submitObserve(session.client, holderLockTx(issuanceId, issuer.classicAddress, holder), issuer)
}

export async function holderUnlock(session: Session, issuanceId: string, issuer: Wallet, holder: string): Promise<string> {
  return submitObserve(session.client, holderUnlockTx(issuanceId, issuer.classicAddress, holder), issuer)
}

/** True when the issuance itself carries lsfMPTLocked. */
export async function isGloballyLocked(session: Session, issuanceId: string): Promise<boolean> {
  return (await issuanceFlags(session.client, issuanceId)).lsfMPTLocked === true
}

/** True when the holder's MPToken carries lsfMPTLocked (false when no entry). */
export async function isHolderLocked(session: Session, issuanceId: string, holder: string): Promise<boolean> {
  const token = await getMPToken(session.client, issuanceId, holder)
  return token !== undefined && parseMPTokenFlags(token.Flags).lsfMPTLocked === true
}

async function main(): Promise<void> {
  const session = await openSession()
  try {
    const { issuer, issuanceId } = await issueToken(session)
    const alice = await onboardHolder(session, issuanceId, issuer, '1000')
    const bob = await onboardHolder(session, issuanceId, issuer, '1000')
    const log = (label: string, value: unknown): void => {
      // eslint-disable-next-line no-console
      console.log(label.padEnd(60), value)
    }

    log('global lock', await globalLock(session, issuanceId, issuer))
    log('issuance lsfMPTLocked', await isGloballyLocked(session, issuanceId))
    log('alice MPToken lsfMPTLocked during global lock', await isHolderLocked(session, issuanceId, alice.classicAddress))
    log('alice pays bob during global lock', await pay(session, issuanceId, alice, bob.classicAddress, '10'))
    log('issuer pays alice during global lock', await pay(session, issuanceId, issuer, alice.classicAddress, '10'))
    log('bob redeems to issuer during global lock', await pay(session, issuanceId, bob, issuer.classicAddress, '10'))
    log('global lock again (idempotent?)', await globalLock(session, issuanceId, issuer))
    log('global unlock', await globalUnlock(session, issuanceId, issuer))
    log('issuance lsfMPTLocked', await isGloballyLocked(session, issuanceId))
    log('alice pays bob after unlock', await pay(session, issuanceId, alice, bob.classicAddress, '10'))

    log('lock alice', await holderLock(session, issuanceId, issuer, alice.classicAddress))
    log('alice MPToken lsfMPTLocked', await isHolderLocked(session, issuanceId, alice.classicAddress))
    log('issuance lsfMPTLocked (should stay false)', await isGloballyLocked(session, issuanceId))
    log('alice pays bob while alice locked', await pay(session, issuanceId, alice, bob.classicAddress, '10'))
    log('bob pays alice while alice locked', await pay(session, issuanceId, bob, alice.classicAddress, '10'))
    log('issuer pays alice while alice locked', await pay(session, issuanceId, issuer, alice.classicAddress, '10'))
    log('lock alice again (idempotent?)', await holderLock(session, issuanceId, issuer, alice.classicAddress))
    log('unlock alice', await holderUnlock(session, issuanceId, issuer, alice.classicAddress))
    log('alice pays bob after unlock', await pay(session, issuanceId, alice, bob.classicAddress, '10'))
    log('unlock alice again (idempotent?)', await holderUnlock(session, issuanceId, issuer, alice.classicAddress))
    log('alice balance', await holderBalance(session.client, issuanceId, alice.classicAddress))
    log('bob balance', await holderBalance(session.client, issuanceId, bob.classicAddress))
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
