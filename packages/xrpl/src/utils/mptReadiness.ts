/* eslint-disable no-bitwise -- Ledger flags are protocol bit masks. */
import BigNumber from 'bignumber.js'

import type { Client } from '../client'
import { ValidationError } from '../errors'
import { MPToken, MPTokenIssuanceFlags, MPTokenFlags } from '../models/ledger'

import { mptToUnits } from './mptConversion'
import {
  fetchMPTokenIssuanceOrUndefined,
  fetchMPTokenOrUndefined,
} from './mptLedgerEntries'

export interface MptTransferCheck {
  status: 'pass' | 'blocked' | 'unknown'
  message: string
}

export interface MptTransferInput {
  account: string
  destination: string
  mptIssuanceId: string
  /** Positive integer raw units. Omit for recipient/authorization checks only. */
  amount?: string
}

export interface MptTransferReadiness {
  /** Eligibility of the checks performed, never a promise of transaction success. */
  status: 'eligible' | 'blocked' | 'unknown'
  ledgerIndex: number
  checks: MptTransferCheck[]
  /** Checks which require the final transaction or additional protocol support. */
  notChecked: readonly string[]
}

// eslint-disable-next-line max-params -- Holder, role and the two authorization policies.
function holderChecks(
  token: MPToken | undefined,
  name: string,
  requiresAuth: boolean,
  domain: boolean,
): MptTransferCheck[] {
  if (!token) {
    return [
      {
        status: 'blocked',
        message: `${name} has not authorized a holding for this MPT.`,
      },
    ]
  }
  if (requiresAuth && !(token.Flags & MPTokenFlags.lsfMPTAuthorized)) {
    return [
      {
        status: domain ? 'unknown' : 'blocked',
        message: domain
          ? `${name}'s permissioned-domain credentials require an additional check.`
          : `${name} has not been authorized by the issuer.`,
      },
    ]
  }
  return [{ status: 'pass', message: `${name} has an eligible MPT holding.` }]
}

/**
 * Advisory eligibility checks for a direct MPT transfer at one validated ledger.
 * Covers holdings, allow-listing, locks, transfers, balance and supply. Domain
 * credentials and transfer fees can require additional checks. Network failures
 * throw; they are never interpreted as missing accounts or successful checks.
 *
 * @param client - Connected client.
 * @param input - Source, destination, issuance and optional amount in raw units.
 * @returns A snapshot with explicit limits. Re-check before signing; state can change.
 */
// eslint-disable-next-line max-lines-per-function, max-statements, complexity -- Coherent snapshot checks.
export async function getMptTransferReadiness(
  client: Client,
  input: MptTransferInput,
): Promise<MptTransferReadiness> {
  const { account, destination, mptIssuanceId, amount } = input
  if (amount !== undefined && new BigNumber(mptToUnits(amount, 0)).lte(0)) {
    throw new ValidationError('MPT transfer amount must be positive.')
  }
  const ledgerIndex = await client.getLedgerIndex()
  const checks: MptTransferCheck[] = []
  const issuance = await fetchMPTokenIssuanceOrUndefined(
    client,
    mptIssuanceId,
    ledgerIndex,
  )
  const notChecked = [
    'XRP fees and reserves',
    'Signer authority and quorum',
    'Sequence and expiry',
    'Destination tags and deposit authorization',
    'Paths, partial payments and sponsorship',
  ]
  if (!issuance) {
    return {
      status: 'blocked',
      ledgerIndex,
      checks: [{ status: 'blocked', message: 'MPT issuance does not exist.' }],
      notChecked,
    }
  }
  const isMint = account === issuance.Issuer
  const isRedemption = destination === issuance.Issuer
  if (account === destination) {
    checks.push({
      status: 'blocked',
      message: 'Source and destination must differ.',
    })
  }
  const [source, target] = await Promise.all([
    isMint
      ? undefined
      : fetchMPTokenOrUndefined(client, account, mptIssuanceId, ledgerIndex),
    isRedemption
      ? undefined
      : fetchMPTokenOrUndefined(
          client,
          destination,
          mptIssuanceId,
          ledgerIndex,
        ),
  ])
  const requireAuth = Boolean(
    issuance.Flags & MPTokenIssuanceFlags.lsfMPTRequireAuth,
  )
  if (!isMint) {
    checks.push(
      ...holderChecks(
        source,
        'Source',
        requireAuth && !isRedemption,
        Boolean(issuance.DomainID),
      ),
    )
  }
  if (!isRedemption) {
    checks.push(
      ...holderChecks(
        target,
        'Destination',
        requireAuth,
        Boolean(issuance.DomainID),
      ),
    )
    if (
      issuance.Flags & MPTokenIssuanceFlags.lsfMPTLocked ||
      (source && source.Flags & MPTokenFlags.lsfMPTLocked) ||
      (target && target.Flags & MPTokenFlags.lsfMPTLocked)
    ) {
      checks.push({
        status: 'blocked',
        message: 'The issuance or a holder is locked for this transfer.',
      })
    }
    if (!isMint && !(issuance.Flags & MPTokenIssuanceFlags.lsfMPTCanTransfer)) {
      checks.push({
        status: 'blocked',
        message: 'This issuance does not permit transfers between holders.',
      })
    }
  }
  // eslint-disable-next-line no-negated-condition -- Keep amount-specific checks grouped together.
  if (amount !== undefined) {
    if (
      isMint &&
      new BigNumber(issuance.OutstandingAmount)
        .plus(amount)
        .gt(issuance.MaximumAmount ?? '9223372036854775807')
    ) {
      checks.push({
        status: 'blocked',
        message: 'Minting this amount would exceed the maximum supply.',
      })
    }
    if (!isMint && new BigNumber(source?.MPTAmount ?? '0').lt(amount)) {
      checks.push({
        status: 'blocked',
        message: 'The source has insufficient MPT balance.',
      })
    }
    if (!isMint && !isRedemption && issuance.TransferFee) {
      checks.push({
        status: 'unknown',
        message:
          'A transfer fee applies; the final debit requires an additional check.',
      })
    }
  } else {
    notChecked.push('Amount, balance and supply limits')
  }
  let status: MptTransferReadiness['status'] = 'eligible'
  if (checks.some((check) => check.status === 'unknown')) {
    status = 'unknown'
  }
  if (checks.some((check) => check.status === 'blocked')) {
    status = 'blocked'
  }
  return { status, ledgerIndex, checks, notChecked }
}
