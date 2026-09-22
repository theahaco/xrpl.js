/**
 * `ban`: the pre-emptive ban.
 *
 * What the ledger offers for an address that has NO MPToken yet:
 *   - allow-listing (`lsfMPTRequireAuth`): a never-authorized address cannot
 *     receive; nothing needs to be written on-ledger to keep it that way.
 *   - per-holder lock (`MPTokenIssuanceSet` + `Holder` + `tfMPTLock`): only
 *     possible once the holder's MPToken exists.
 *   - `DomainID` (permissioned domain + credentials): an alternative admission
 *     model that cannot be combined with `Holder` on the same transaction and
 *     whitelists, never blacklists.
 *
 * There is no on-ledger object that says "this address is banned". The best
 * achievable model is: record the ban locally, refuse ever to authorize the
 * address, and when (if) it opts in later, lock its empty MPToken so that even
 * a future accidental authorization cannot make it spendable. For a current
 * holder: lock, then claw back.
 */
import { Clawback, Wallet } from 'xrpl'

import { holderLock, isHolderLocked } from './freeze'
import { authorize, onboardHolder, optIn, optOutTx, pay, unauthorize } from './holders'
import { getMPToken, holderBalance, parseMPTokenFlags } from './inspect'
import { issueToken } from './issue'
import { Session, fundWallet, openSession } from './session'
import { submitObserve } from './tx'

export interface BanRegistry {
  banned: Set<string>
}

export interface BanOutcome {
  address: string
  hadMPToken: boolean
  balanceBefore: string
  lock?: string
  clawback?: string
  balanceAfter: string
}

export function clawbackTx(issuanceId: string, issuer: string, holder: string, value: string): Clawback {
  return {
    TransactionType: 'Clawback',
    Account: issuer,
    Amount: { mpt_issuance_id: issuanceId, value },
    Holder: holder,
  }
}

/**
 * Ban an address. Always records it locally. If the address already has an
 * MPToken: lock it immediately and (optionally) claw back the balance. If not:
 * nothing can be written on-ledger yet; `sweepBanned` handles lock-on-arrival.
 */
export async function banAddress(
  session: Session,
  issuanceId: string,
  issuer: Wallet,
  address: string,
  registry: BanRegistry,
  opts: { clawback?: boolean } = {},
): Promise<BanOutcome> {
  registry.banned.add(address)
  const token = await getMPToken(session.client, issuanceId, address)
  const balanceBefore = token?.MPTAmount ?? '0'
  const outcome: BanOutcome = { address, hadMPToken: token !== undefined, balanceBefore, balanceAfter: balanceBefore }
  if (token === undefined) {
    return outcome
  }
  outcome.lock = await holderLock(session, issuanceId, issuer, address)
  if ((opts.clawback ?? true) && balanceBefore !== '0') {
    outcome.clawback = await submitObserve(
      session.client,
      clawbackTx(issuanceId, issuer.classicAddress, address, balanceBefore),
      issuer,
    )
  }
  outcome.balanceAfter = await holderBalance(session.client, issuanceId, address)
  return outcome
}

/**
 * Guard for the authorization path: a banned address must never be
 * authorized. This is the only "pre-emptive" enforcement that exists; it lives
 * in the issuer's software, not on the ledger.
 */
export async function authorizeUnlessBanned(
  session: Session,
  issuanceId: string,
  issuer: Wallet,
  holder: string,
  registry: BanRegistry,
): Promise<string> {
  if (registry.banned.has(holder)) {
    return 'refused-by-ban-registry'
  }
  return authorize(session, issuanceId, issuer, holder)
}

/**
 * Lock-on-arrival: for every banned address that now has an (unlocked)
 * MPToken, lock it. rippled has no way to enumerate holders (`mpt_holders` is
 * Clio-only), so this walks the registry and does one `ledger_entry` each.
 */
export async function sweepBanned(
  session: Session,
  issuanceId: string,
  issuer: Wallet,
  registry: BanRegistry,
): Promise<Array<{ address: string; action: string }>> {
  const actions: Array<{ address: string; action: string }> = []
  for (const address of registry.banned) {
    // eslint-disable-next-line no-await-in-loop -- sequential issuer Sequence
    const token = await getMPToken(session.client, issuanceId, address)
    if (token === undefined) {
      actions.push({ address, action: 'no MPToken yet' })
    } else if (parseMPTokenFlags(token.Flags).lsfMPTLocked === true) {
      actions.push({ address, action: 'already locked' })
    } else {
      // eslint-disable-next-line no-await-in-loop -- sequential issuer Sequence
      actions.push({ address, action: `lock -> ${await holderLock(session, issuanceId, issuer, address)}` })
    }
  }
  return actions
}

async function main(): Promise<void> {
  const session = await openSession()
  try {
    const { issuer, issuanceId } = await issueToken(session)
    const registry: BanRegistry = { banned: new Set() }
    const alice = await onboardHolder(session, issuanceId, issuer, '1000')
    const mallory = await fundWallet(session)
    const log = (label: string, value: unknown): void => {
      // eslint-disable-next-line no-console
      console.log(label.padEnd(64), value)
    }

    // --- pre-emptive: mallory has no MPToken ---
    log('ban mallory (no MPToken yet)', await banAddress(session, issuanceId, issuer, mallory.classicAddress, registry))
    log('issuer authorize mallory pre-emptively (no MPToken)', await authorize(session, issuanceId, issuer, mallory.classicAddress))
    log('issuer lock mallory pre-emptively (no MPToken)', await holderLock(session, issuanceId, issuer, mallory.classicAddress))
    log('issuer unauthorize mallory pre-emptively (no MPToken)', await unauthorize(session, issuanceId, issuer, mallory.classicAddress))
    log('alice pays mallory (no MPToken)', await pay(session, issuanceId, alice, mallory.classicAddress, '10'))
    log('mallory opts in (cannot be prevented)', await optIn(session, issuanceId, mallory))
    log('alice pays mallory (opted in, unauthorized)', await pay(session, issuanceId, alice, mallory.classicAddress, '10'))
    log('authorizeUnlessBanned(mallory)', await authorizeUnlessBanned(session, issuanceId, issuer, mallory.classicAddress, registry))
    log('sweep: lock-on-arrival', await sweepBanned(session, issuanceId, issuer, registry))
    log('mallory locked (zero balance, unauthorized)?', await isHolderLocked(session, issuanceId, mallory.classicAddress))
    log('issuer authorizes mallory anyway (operator mistake)', await authorize(session, issuanceId, issuer, mallory.classicAddress))
    log('alice pays mallory (authorized but locked)', await pay(session, issuanceId, alice, mallory.classicAddress, '10'))
    log('mallory MPToken flags', parseMPTokenFlags((await getMPToken(session.client, issuanceId, mallory.classicAddress))?.Flags ?? 0))
    log('issuer unauthorizes mallory again', await unauthorize(session, issuanceId, issuer, mallory.classicAddress))
    log('mallory MPToken flags after unauthorize (lock retained?)', parseMPTokenFlags((await getMPToken(session.client, issuanceId, mallory.classicAddress))?.Flags ?? 0))
    log('mallory opts out while locked (zero balance)', await submitObserve(session.client, optOutTx(issuanceId, mallory.classicAddress), mallory))
    log('mallory MPToken after opt-out attempt', await getMPToken(session.client, issuanceId, mallory.classicAddress))

    // --- current holder: alice has 1000 ---
    const bob = await onboardHolder(session, issuanceId, issuer, '100')
    log('ban alice (current holder, lock + clawback)', await banAddress(session, issuanceId, issuer, alice.classicAddress, registry))
    log('alice pays bob after ban', await pay(session, issuanceId, alice, bob.classicAddress, '1'))
    log('bob pays alice after ban', await pay(session, issuanceId, bob, alice.classicAddress, '1'))
    log('alice MPToken after ban', await getMPToken(session.client, issuanceId, alice.classicAddress))

    // --- unauthorize semantics on a funded holder ---
    log('issuer unauthorizes bob (balance 100)', await unauthorize(session, issuanceId, issuer, bob.classicAddress))
    log('bob balance after unauthorize', await holderBalance(session.client, issuanceId, bob.classicAddress))
    log('bob flags after unauthorize', parseMPTokenFlags((await getMPToken(session.client, issuanceId, bob.classicAddress))?.Flags ?? 0))
    log('bob pays issuer 10 while unauthorized', await pay(session, issuanceId, bob, issuer.classicAddress, '10'))
    log('issuer pays bob 10 while unauthorized', await pay(session, issuanceId, issuer, bob.classicAddress, '10'))
    log('lock bob while unauthorized', await holderLock(session, issuanceId, issuer, bob.classicAddress))
    log('bob flags (unauthorized + locked)', parseMPTokenFlags((await getMPToken(session.client, issuanceId, bob.classicAddress))?.Flags ?? 0))
    log('bob pays issuer 10 while unauthorized + locked', await pay(session, issuanceId, bob, issuer.classicAddress, '10'))
    log('re-authorize bob while locked', await authorize(session, issuanceId, issuer, bob.classicAddress))
    log('bob flags (authorized + locked)', parseMPTokenFlags((await getMPToken(session.client, issuanceId, bob.classicAddress))?.Flags ?? 0))
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
