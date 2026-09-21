/**
 * `holders`: holder opt-in, issuer authorization, issuer→holder and
 * holder→holder payments.
 */
import { MPTokenAuthorize, MPTokenAuthorizeFlags, Payment, Wallet } from 'xrpl'

import { holderBalance, getMPToken, parseMPTokenFlags } from './inspect'
import { issueToken } from './issue'
import { Session, fundWallet, openSession } from './session'
import { submitObserve, submitOk } from './tx'

/** Holder creates its own (empty, unauthorized) MPToken entry. */
export function optInTx(issuanceId: string, holder: string): MPTokenAuthorize {
  return { TransactionType: 'MPTokenAuthorize', Account: holder, MPTokenIssuanceID: issuanceId }
}

/** Holder deletes its own MPToken entry (only allowed with zero balance). */
export function optOutTx(issuanceId: string, holder: string): MPTokenAuthorize {
  return {
    TransactionType: 'MPTokenAuthorize',
    Account: holder,
    MPTokenIssuanceID: issuanceId,
    Flags: MPTokenAuthorizeFlags.tfMPTUnauthorize,
  }
}

/** Issuer sets lsfMPTAuthorized on the holder's MPToken (allow-list). */
export function authorizeTx(issuanceId: string, issuer: string, holder: string): MPTokenAuthorize {
  return { TransactionType: 'MPTokenAuthorize', Account: issuer, MPTokenIssuanceID: issuanceId, Holder: holder }
}

/** Issuer clears lsfMPTAuthorized on the holder's MPToken. */
export function unauthorizeTx(issuanceId: string, issuer: string, holder: string): MPTokenAuthorize {
  return {
    TransactionType: 'MPTokenAuthorize',
    Account: issuer,
    MPTokenIssuanceID: issuanceId,
    Holder: holder,
    Flags: MPTokenAuthorizeFlags.tfMPTUnauthorize,
  }
}

/**
 * MPT payment. `value` is the integer number of *fractional units*
 * (10^-AssetScale), not a decimal.
 *
 * AUDIT-016: `MPTAmount.value` is a plain string; the SDK neither validates it
 * (decimals/negatives pass `validate()` and only fail inside the binary codec
 * with "is an illegal amount") nor offers an AssetScale-aware helper like
 * `xrpToDrops`.
 */
export function payTx(issuanceId: string, from: string, to: string, value: string): Payment {
  return {
    TransactionType: 'Payment',
    Account: from,
    Destination: to,
    Amount: { mpt_issuance_id: issuanceId, value },
  }
}

export async function optIn(session: Session, issuanceId: string, holder: Wallet): Promise<string> {
  return submitObserve(session.client, optInTx(issuanceId, holder.classicAddress), holder)
}

export async function authorize(session: Session, issuanceId: string, issuer: Wallet, holder: string): Promise<string> {
  return submitObserve(session.client, authorizeTx(issuanceId, issuer.classicAddress, holder), issuer)
}

export async function unauthorize(session: Session, issuanceId: string, issuer: Wallet, holder: string): Promise<string> {
  return submitObserve(session.client, unauthorizeTx(issuanceId, issuer.classicAddress, holder), issuer)
}

export async function pay(session: Session, issuanceId: string, from: Wallet, to: string, value: string): Promise<string> {
  return submitObserve(session.client, payTx(issuanceId, from.classicAddress, to, value), from)
}

/** Full onboarding: fund, opt in, authorize, seed with `value` units from the issuer. */
export async function onboardHolder(session: Session, issuanceId: string, issuer: Wallet, value: string): Promise<Wallet> {
  const holder = await fundWallet(session)
  await submitOk(session.client, optInTx(issuanceId, holder.classicAddress), holder)
  await submitOk(session.client, authorizeTx(issuanceId, issuer.classicAddress, holder.classicAddress), issuer)
  await submitOk(session.client, payTx(issuanceId, issuer.classicAddress, holder.classicAddress, value), issuer)
  return holder
}

async function main(): Promise<void> {
  const session = await openSession()
  try {
    const { issuer, issuanceId } = await issueToken(session)
    const alice = await fundWallet(session)
    const bob = await fundWallet(session)

    const log = (label: string, value: unknown): void => {
      // eslint-disable-next-line no-console
      console.log(label.padEnd(58), value)
    }

    log('alice opts in', await optIn(session, issuanceId, alice))
    const fresh = await getMPToken(session.client, issuanceId, alice.classicAddress)
    log('alice MPToken right after opt-in (raw)', fresh)
    log('issuer pays alice before authorizing (RequireAuth)', await pay(session, issuanceId, issuer, alice.classicAddress, '1000'))
    log('issuer authorizes alice', await authorize(session, issuanceId, issuer, alice.classicAddress))
    log('alice flags after authorize', parseMPTokenFlags((await getMPToken(session.client, issuanceId, alice.classicAddress))?.Flags ?? 0))
    log('issuer pays alice 1000', await pay(session, issuanceId, issuer, alice.classicAddress, '1000'))
    log('alice balance', await holderBalance(session.client, issuanceId, alice.classicAddress))

    log('bob opts in', await optIn(session, issuanceId, bob))
    log('alice pays bob before bob is authorized', await pay(session, issuanceId, alice, bob.classicAddress, '250'))
    log('issuer authorizes bob', await authorize(session, issuanceId, issuer, bob.classicAddress))
    log('alice pays bob 250', await pay(session, issuanceId, alice, bob.classicAddress, '250'))
    log('alice balance', await holderBalance(session.client, issuanceId, alice.classicAddress))
    log('bob balance', await holderBalance(session.client, issuanceId, bob.classicAddress))
    log('bob pays issuer 50 (redeem)', await pay(session, issuanceId, bob, issuer.classicAddress, '50'))
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
