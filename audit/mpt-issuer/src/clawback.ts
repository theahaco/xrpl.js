/**
 * `clawback`: Clawback with an MPT amount + Holder, exercised while the holder
 * is unlocked, locked, unauthorized, and during a global freeze; partial and
 * full amounts; and the `value` string edge cases. For each edge case we
 * record *which layer* reports the problem (SDK ValidationError, binary codec,
 * or rippled engine result) — that difference is the audit's lens (e).
 */
import { Clawback, ValidationError, Wallet, validate } from 'xrpl'

import { clawbackTx } from './ban'
import { globalLock, globalUnlock, holderLock, holderUnlock } from './freeze'
import { onboardHolder, unauthorize } from './holders'
import { holderBalance, getMPToken } from './inspect'
import { issueToken } from './issue'
import { Session, fundWallet, openSession } from './session'
import { submitObserve } from './tx'

export { clawbackTx }

export interface Observed {
  layer: 'engine' | 'ValidationError' | 'codec' | 'error'
  detail: string
}

/**
 * Submit and report which layer rejected (or which engine result applied).
 * `submitAndWait` runs autofill → validate → sign(encode) → submit, so a
 * malformed amount can surface from three different places.
 */
export async function observe(session: Session, tx: Clawback, wallet: Wallet): Promise<Observed> {
  try {
    return { layer: 'engine', detail: await submitObserve(session.client, tx, wallet) }
  } catch (err) {
    if (err instanceof ValidationError) {
      return { layer: 'ValidationError', detail: err.message }
    }
    if (err instanceof Error && /illegal amount|Invalid type to construct an Amount/u.test(err.message)) {
      return { layer: 'codec', detail: err.message }
    }
    return { layer: 'error', detail: err instanceof Error ? `${err.constructor.name}: ${err.message}` : String(err) }
  }
}

/** What the SDK's standalone `validate()` says about a tx, without touching the network. */
export function validateOnly(tx: Clawback): string {
  try {
    validate(tx)
    return 'ok'
  } catch (err) {
    return err instanceof Error ? `${err.constructor.name}: ${err.message}` : String(err)
  }
}

async function main(): Promise<void> {
  const session = await openSession()
  try {
    const { issuer, issuanceId } = await issueToken(session)
    const alice = await onboardHolder(session, issuanceId, issuer, '1000')
    const issuerAddr = issuer.classicAddress
    const claw = (holder: string, value: string): Clawback => clawbackTx(issuanceId, issuerAddr, holder, value)
    const log = (label: string, value: unknown): void => {
      // eslint-disable-next-line no-console
      console.log(label.padEnd(60), value)
    }
    const balance = async (): Promise<string> => holderBalance(session.client, issuanceId, alice.classicAddress)

    log('partial clawback 100 (unlocked)', await observe(session, claw(alice.classicAddress, '100'), issuer))
    log('alice balance', await balance())

    log('lock alice', await holderLock(session, issuanceId, issuer, alice.classicAddress))
    log('clawback 100 while alice locked', await observe(session, claw(alice.classicAddress, '100'), issuer))
    log('alice balance', await balance())
    log('unlock alice', await holderUnlock(session, issuanceId, issuer, alice.classicAddress))

    log('global lock', await globalLock(session, issuanceId, issuer))
    log('clawback 100 during global freeze', await observe(session, claw(alice.classicAddress, '100'), issuer))
    log('alice balance', await balance())
    log('global unlock', await globalUnlock(session, issuanceId, issuer))

    log('unauthorize alice', await unauthorize(session, issuanceId, issuer, alice.classicAddress))
    log('clawback 100 while alice unauthorized', await observe(session, claw(alice.classicAddress, '100'), issuer))
    log('alice balance', await balance())

    log('clawback 5000 (> balance 600)', await observe(session, claw(alice.classicAddress, '5000'), issuer))
    log('alice balance', await balance())
    log('alice MPToken entry after over-clawback', await getMPToken(session.client, issuanceId, alice.classicAddress))
    log('clawback 1 from empty holder', await observe(session, claw(alice.classicAddress, '1'), issuer))

    // A holder with no MPToken at all.
    const nobody = await fundWallet(session)
    log('clawback from address with no MPToken', await observe(session, claw(nobody.classicAddress, '1'), issuer))

    // --- value edge cases: which layer catches what? ---
    const bob = await onboardHolder(session, issuanceId, issuer, '10')
    const cases: Array<[string, string]> = [
      ['zero', '0'],
      ['negative', '-1'],
      ['decimal', '1.5'],
      ['exponent', '1e2'],
      ['leading plus', '+1'],
      ['hex-looking', '0x10'],
      ['empty', ''],
      ['whitespace', ' 1'],
      ['max int64', '9223372036854775807'],
      ['max int64 + 1', '9223372036854775808'],
      ['max uint64', '18446744073709551615'],
      ['above uint64', '18446744073709551616'],
    ]
    for (const [name, value] of cases) {
      const tx = claw(bob.classicAddress, value)
      // eslint-disable-next-line no-await-in-loop -- sequential on purpose
      const result = await observe(session, tx, issuer)
      log(`value ${name} (${JSON.stringify(value)}): validate()`, validateOnly(tx))
      log(`value ${name} (${JSON.stringify(value)}): submit`, result)
    }
    log('bob balance after edge cases', await holderBalance(session.client, issuanceId, bob.classicAddress))

    // --- structural edge cases ---
    log('self-clawback (Holder = issuer): validate()', validateOnly(claw(issuerAddr, '1')))
    log('self-clawback (Holder = issuer): submit', await observe(session, claw(issuerAddr, '1'), issuer))
    const noHolder: Clawback = { TransactionType: 'Clawback', Account: issuerAddr, Amount: { mpt_issuance_id: issuanceId, value: '1' } }
    log('missing Holder: validate()', validateOnly(noHolder))
    log('missing Holder: submit', await observe(session, noHolder, issuer))
    const notIssuer: Clawback = clawbackTx(issuanceId, alice.classicAddress, bob.classicAddress, '1')
    log('non-issuer claws back: validate()', validateOnly(notIssuer))
    log('non-issuer claws back: submit', await observe(session, notIssuer, alice))
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
