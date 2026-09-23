/* eslint-disable no-bitwise -- Payment flags are protocol bit masks. */
import type { Client } from '../client'
import { XrplError } from '../errors'
import type { MPTAmount } from '../models/common'
import type { AccountTxTransaction } from '../models/methods'
import { Payment, PaymentFlags } from '../models/transactions'

export interface MptPaymentRecord {
  transaction: Payment & { Amount: MPTAmount }
  /** Actual delivered units; absent when historical metadata cannot establish it. */
  deliveredAmount?: string
  hash?: string
  ledgerIndex: number
}

export interface MptPaymentHistory {
  /** Complete only within the server's available range reported here. */
  ledgerIndexMin: number
  ledgerIndexMax: number
  payments: MptPaymentRecord[]
}

// eslint-disable-next-line complexity -- Narrow untrusted history rows and distinguish delivered from requested amounts.
function paymentRecord(
  entry: AccountTxTransaction<1>,
  account: string,
  issuance: string,
): MptPaymentRecord | undefined {
  const { tx, meta } = entry
  if (
    !entry.validated ||
    tx?.TransactionType !== 'Payment' ||
    tx.Account !== account ||
    typeof meta === 'string' ||
    meta.TransactionResult !== 'tesSUCCESS' ||
    typeof tx.Amount === 'string' ||
    !('mpt_issuance_id' in tx.Amount) ||
    tx.Amount.mpt_issuance_id !== issuance
  ) {
    return undefined
  }
  const delivered = meta.delivered_amount
  let deliveredAmount: string | undefined
  if (
    typeof delivered === 'object' &&
    'mpt_issuance_id' in delivered &&
    delivered.mpt_issuance_id === issuance
  ) {
    deliveredAmount = delivered.value
  } else if (
    delivered === undefined &&
    !(typeof tx.Flags === 'number' && tx.Flags & PaymentFlags.tfPartialPayment)
  ) {
    deliveredAmount = tx.Amount.value
  }
  return {
    transaction: { ...tx, Amount: tx.Amount },
    deliveredAmount,
    hash: tx.hash,
    ledgerIndex: entry.ledger_index,
  }
}

/**
 * Read all available pages of validated, successful outgoing payments of one MPT.
 * Pins the ledger range; throws if a page fails or the available range changes.
 * Uses API v1 deliberately to retain the submitted Payment.Amount shape.
 *
 * @param client - Connected client.
 * @param account - Sending account, not merely an account mentioned by a payment.
 * @param issuance - Exact MPT issuance ID to include.
 * @returns Matching payments and the searched range; not a full-history guarantee.
 */
// eslint-disable-next-line max-lines-per-function -- Keep pagination and completeness checks in the same loop.
export async function getMptPaymentHistory(
  client: Client,
  account: string,
  issuance: string,
): Promise<MptPaymentHistory> {
  const ledgerIndexMax = await client.getLedgerIndex()
  let ledgerIndexMin = -1
  let marker: unknown
  const seen = new Set<string>()
  const payments: MptPaymentRecord[] = []
  do {
    // eslint-disable-next-line no-await-in-loop -- Each page depends on the previous marker.
    const { result } = await client.request({
      command: 'account_tx',
      account,
      api_version: 1,
      binary: false,
      ledger_index_min: ledgerIndexMin,
      ledger_index_max: ledgerIndexMax,
      marker,
    })
    if (ledgerIndexMin === -1) {
      ledgerIndexMin = result.ledger_index_min
    }
    if (
      result.ledger_index_min !== ledgerIndexMin ||
      result.ledger_index_max !== ledgerIndexMax
    ) {
      throw new XrplError(
        'Account history range changed or is unavailable; completeness cannot be established.',
      )
    }
    for (const entry of result.transactions) {
      const record = paymentRecord(entry, account, issuance)
      if (record) {
        payments.push(record)
      }
    }
    marker = result.marker
    if (marker != null) {
      const key = JSON.stringify(marker)
      if (seen.has(key)) {
        throw new XrplError(
          'Account history returned a repeated pagination marker.',
        )
      }
      seen.add(key)
    }
  } while (marker != null)
  return { ledgerIndexMin, ledgerIndexMax, payments }
}
