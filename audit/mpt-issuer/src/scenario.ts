/**
 * `scenario`: one end-to-end run of the whole lifecycle with assertions.
 *
 *   issue -> holders -> ban known address before it opts in -> holder tries to
 *   opt in -> ban a current holder -> lock-on-ban -> clawback -> global freeze
 *   -> holder payment fails -> unfreeze
 *
 * Prints a pass/fail table and exits non-zero on any failure. This is the
 * audit's executable evidence; every expected value below was first observed
 * on rippled 3.4.0-rc1 (see audit/README.md for the recipe).
 */
import fs from 'node:fs'

import {
  MPTokenIssuanceDestroy,
  MPTokenIssuanceSet,
  MPTokenIssuanceSetFlags,
  parseMPTokenIssuanceFlags,
  parseMPTokenIssuanceImmutableFlags,
} from 'xrpl'

import { BanRegistry, authorizeUnlessBanned, banAddress, clawbackTx, sweepBanned } from './ban'
import { globalLock, globalUnlock, holderLock, holderUnlock, isGloballyLocked, isHolderLocked } from './freeze'
import { authorize, onboardHolder, optIn, pay } from './holders'
import { mptIssuanceIndex, mptokenIndex } from './ids'
import { getIssuance, getMPToken, holderBalance, parseMPTokenFlags, tryMptHolders } from './inspect'
import { PINNED_OFF, PINNED_ON, issueToken } from './issue'
import { Report } from './report'
import { fundWallet, openSession } from './session'
import { submitObserve } from './tx'

async function main(): Promise<void> {
  const session = await openSession()
  const report = new Report()
  const { client } = session
  try {
    const info = await client.request({ command: 'server_info' })
    // eslint-disable-next-line no-console
    console.log(`rippled ${info.result.info.build_version} at ${client.url}; xrpl resolves to ${fs.realpathSync(require.resolve('xrpl'))}\n`)

    // ------------------------------------------------------------------ issue
    const { issuer, issuanceId, derivedIssuanceId } = await issueToken(session)
    const issuance = await getIssuance(client, issuanceId)
    report.expect('issue: derived MPTokenIssuanceID == meta.mpt_issuance_id', issuanceId, derivedIssuanceId)
    report.expect('issue: ledger_entry index == derived keylet', mptIssuanceIndex(issuanceId), issuance.index)
    report.expect('issue: rippled injects mpt_issuance_id into the entry JSON', issuanceId, issuance.mpt_issuance_id ?? 'absent')
    const lsf = parseMPTokenIssuanceFlags(issuance.Flags)
    report.expect('issue: lsfMPTCanLock|RequireAuth|CanClawback|CanTransfer set', 'true',
      String(lsf.lsfMPTCanLock === true && lsf.lsfMPTRequireAuth === true && lsf.lsfMPTCanClawback === true && lsf.lsfMPTCanTransfer === true))
    report.expect('issue: lsfMPTCanTrade/CanEscrow not set', 'true', String(lsf.lsfMPTCanTrade === undefined && lsf.lsfMPTCanEscrow === undefined))
    // eslint-disable-next-line no-bitwise
    report.expect('issue: ImmutableFlags persisted', String(PINNED_OFF | PINNED_ON), String(issuance.ImmutableFlags))
    report.expect('issue: OutstandingAmount starts at "0" (present, not omitted)', '0', issuance.OutstandingAmount)

    // ---------------------------------------------------------------- holders
    const alice = await onboardHolder(session, issuanceId, issuer, '1000')
    const bob = await onboardHolder(session, issuanceId, issuer, '500')
    report.expect('holders: alice balance after onboarding', '1000', await holderBalance(client, issuanceId, alice.classicAddress))
    const aliceToken = await getMPToken(client, issuanceId, alice.classicAddress)
    report.expect('holders: MPToken keylet derivation', aliceToken?.index ?? 'absent', mptokenIndex(issuanceId, alice.classicAddress))
    report.expect('holders: MPToken JSON carries Account (missing from SDK type)', alice.classicAddress,
      (aliceToken as unknown as { Account?: string } | undefined)?.Account ?? 'absent')
    report.expect('holders: alice pays bob 100', 'tesSUCCESS', await pay(session, issuanceId, alice, bob.classicAddress, '100'))
    report.expect('holders: balances after transfer', '900/600',
      `${await holderBalance(client, issuanceId, alice.classicAddress)}/${await holderBalance(client, issuanceId, bob.classicAddress)}`)
    const carol = await fundWallet(session)
    report.expect('holders: carol opts in (empty MPToken, no MPTAmount field)', 'tesSUCCESS', await optIn(session, issuanceId, carol))
    const carolToken = await getMPToken(client, issuanceId, carol.classicAddress)
    report.expect('holders: fresh MPToken omits MPTAmount (typed required)', 'undefined', String(carolToken?.MPTAmount))
    report.expect('holders: issuer pays opted-in but unauthorized carol', 'tecNO_AUTH', await pay(session, issuanceId, issuer, carol.classicAddress, '10'))
    report.expect('holders: issuer authorizes carol', 'tesSUCCESS', await authorize(session, issuanceId, issuer, carol.classicAddress))
    report.expect('holders: lsfMPTAuthorized bit is 0x2', 'true',
      String(parseMPTokenFlags((await getMPToken(client, issuanceId, carol.classicAddress))?.Flags ?? 0).lsfMPTAuthorized === true))
    report.expect('holders: issuer pays carol 100', 'tesSUCCESS', await pay(session, issuanceId, issuer, carol.classicAddress, '100'))

    // --------------------------------------------- pre-emptive ban (no MPToken)
    const registry: BanRegistry = { banned: new Set() }
    const mallory = await fundWallet(session)
    const preBan = await banAddress(session, issuanceId, issuer, mallory.classicAddress, registry)
    report.expect('ban: pre-emptive ban records locally, nothing on-ledger', 'false', String(preBan.hadMPToken))
    report.expect('ban: issuer cannot authorize before opt-in', 'tecOBJECT_NOT_FOUND', await authorize(session, issuanceId, issuer, mallory.classicAddress))
    report.expect('ban: issuer cannot lock before opt-in', 'tecOBJECT_NOT_FOUND', await holderLock(session, issuanceId, issuer, mallory.classicAddress))
    report.expect('ban: payment to never-opted-in address', 'tecNO_AUTH', await pay(session, issuanceId, alice, mallory.classicAddress, '1'))
    report.expect('ban: banned address can still opt in (not preventable)', 'tesSUCCESS', await optIn(session, issuanceId, mallory))
    report.expect('ban: payment to opted-in unauthorized address', 'tecNO_AUTH', await pay(session, issuanceId, alice, mallory.classicAddress, '1'))
    report.expect('ban: registry refuses authorization', 'refused-by-ban-registry',
      await authorizeUnlessBanned(session, issuanceId, issuer, mallory.classicAddress, registry))
    const sweep = await sweepBanned(session, issuanceId, issuer, registry)
    report.expect('ban: lock-on-arrival sweep locks the empty MPToken', 'lock -> tesSUCCESS', sweep[0]?.action ?? 'no action')
    report.expect('ban: mallory MPToken locked', 'true', String(await isHolderLocked(session, issuanceId, mallory.classicAddress)))
    report.expect('ban: even a mistaken authorization cannot unlock (lock beats auth)', 'tesSUCCESS', await authorize(session, issuanceId, issuer, mallory.classicAddress))
    report.expect('ban: payment to authorized-but-locked address', 'tecLOCKED', await pay(session, issuanceId, alice, mallory.classicAddress, '1'))

    // ------------------------------------------- ban a current holder (bob)
    const bobBan = await banAddress(session, issuanceId, issuer, bob.classicAddress, registry)
    report.expect('ban: current holder lock', 'tesSUCCESS', bobBan.lock ?? 'skipped')
    report.expect('ban: current holder clawback', 'tesSUCCESS', bobBan.clawback ?? 'skipped')
    report.expect('ban: current holder balance after ban', '0', bobBan.balanceAfter)
    report.expect('ban: banned holder cannot send', 'tecLOCKED', await pay(session, issuanceId, bob, alice.classicAddress, '1'))
    report.expect('ban: banned holder cannot receive', 'tecLOCKED', await pay(session, issuanceId, alice, bob.classicAddress, '1'))
    report.expect('ban: empty locked holder paying issuer surfaces as tecPATH_PARTIAL (not tecLOCKED/UNFUNDED)', 'tecPATH_PARTIAL',
      await pay(session, issuanceId, bob, issuer.classicAddress, '1'))
    report.expect('ban: OutstandingAmount reflects clawback', '1000', (await getIssuance(client, issuanceId)).OutstandingAmount)
    // Per-holder lock vs redemption, on a holder that still has a balance.
    report.expect('lock: lock alice (has balance)', 'tesSUCCESS', await holderLock(session, issuanceId, issuer, alice.classicAddress))
    report.expect('lock: individually locked holder CAN still redeem to issuer (protocol exemption)', 'tesSUCCESS', await pay(session, issuanceId, alice, issuer.classicAddress, '1'))
    report.expect('lock: issuer can still pay an individually locked holder', 'tesSUCCESS', await pay(session, issuanceId, issuer, alice.classicAddress, '1'))
    report.expect('lock: unlock alice', 'tesSUCCESS', await holderUnlock(session, issuanceId, issuer, alice.classicAddress))
    report.expect('lock: alice balance after lock round-trip', '900', await holderBalance(client, issuanceId, alice.classicAddress))

    // --------------------------------------------------------------- clawback
    report.expect('clawback: partial from alice', 'tesSUCCESS',
      await submitObserve(client, clawbackTx(issuanceId, issuer.classicAddress, alice.classicAddress, '100'), issuer))
    report.expect('clawback: alice balance', '800', await holderBalance(client, issuanceId, alice.classicAddress))
    report.expect('clawback: more than balance clamps (carol 100 -> 0)', 'tesSUCCESS',
      await submitObserve(client, clawbackTx(issuanceId, issuer.classicAddress, carol.classicAddress, '999999'), issuer))
    report.expect('clawback: carol balance after over-clawback', '0', await holderBalance(client, issuanceId, carol.classicAddress))
    report.expect('clawback: from empty holder', 'tecINSUFFICIENT_FUNDS',
      await submitObserve(client, clawbackTx(issuanceId, issuer.classicAddress, carol.classicAddress, '1'), issuer))
    report.expect('clawback: refill carol', 'tesSUCCESS', await pay(session, issuanceId, issuer, carol.classicAddress, '100'))

    // ---------------------------------------------------------- global freeze
    report.expect('freeze: global lock', 'tesSUCCESS', await globalLock(session, issuanceId, issuer))
    report.expect('freeze: lsfMPTLocked on issuance', 'true', String(await isGloballyLocked(session, issuanceId)))
    report.expect('freeze: holder MPToken not individually flagged', 'false', String(await isHolderLocked(session, issuanceId, alice.classicAddress)))
    report.expect('freeze: holder payment fails', 'tecLOCKED', await pay(session, issuanceId, alice, carol.classicAddress, '10'))
    report.expect('freeze: issuer can still pay holders (protocol exemption)', 'tesSUCCESS', await pay(session, issuanceId, issuer, carol.classicAddress, '10'))
    report.expect('freeze: holder can still redeem to issuer (protocol exemption)', 'tesSUCCESS', await pay(session, issuanceId, carol, issuer.classicAddress, '10'))
    report.expect('freeze: clawback works during global freeze', 'tesSUCCESS',
      await submitObserve(client, clawbackTx(issuanceId, issuer.classicAddress, alice.classicAddress, '100'), issuer))
    report.expect('freeze: global lock is idempotent', 'tesSUCCESS', await globalLock(session, issuanceId, issuer))
    report.expect('freeze: global unlock', 'tesSUCCESS', await globalUnlock(session, issuanceId, issuer))
    report.expect('freeze: lsfMPTLocked cleared', 'false', String(await isGloballyLocked(session, issuanceId)))
    report.expect('freeze: holder payment works again', 'tesSUCCESS', await pay(session, issuanceId, alice, carol.classicAddress, '10'))
    report.expect('freeze: banned holder stays locked after global unlock', 'true', String(await isHolderLocked(session, issuanceId, bob.classicAddress)))

    // ------------------------------------------------------- immutability
    const setCanTrade: MPTokenIssuanceSet = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: issuer.classicAddress,
      MPTokenIssuanceID: issuanceId,
      Flags: MPTokenIssuanceSetFlags.tfMPTSetCanTrade,
    }
    report.expect('immutable: pinned-off capability cannot be enabled later', 'tecNO_PERMISSION', await submitObserve(client, setCanTrade, issuer))
    report.expect('immutable: lsifMPTCanTrade parsed', 'true',
      String(parseMPTokenIssuanceImmutableFlags((await getIssuance(client, issuanceId)).ImmutableFlags).lsifMPTCanTrade === true))

    // ----------------------------------------------------------- teardown
    const destroy: MPTokenIssuanceDestroy = { TransactionType: 'MPTokenIssuanceDestroy', Account: issuer.classicAddress, MPTokenIssuanceID: issuanceId }
    report.expect('destroy: refused while holders have balances', 'tecHAS_OBLIGATIONS', await submitObserve(client, destroy, issuer))
    report.expect('inspect: mpt_holders is not served by rippled', 'Unknown method.', (await tryMptHolders(client, issuanceId)).detail)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('\nscenario aborted:', err)
    process.exitCode = 1
  } finally {
    report.print()
    if (report.failures.length > 0) {
      process.exitCode = 1
    }
    await session.close()
  }
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exitCode = 1
})
