/* eslint-disable max-lines -- Payment carries MPT, self-send and DeliverMax rules */
import { ValidationError } from '../../errors'
import { Amount, Path, MPTAmount } from '../common'
import { isFlagEnabled } from '../utils'

import {
  BaseTransaction,
  isAmount,
  GlobalFlagsInterface,
  validateBaseTransaction,
  isAccount,
  isDomainID,
  validateRequiredField,
  validateOptionalField,
  isNumber,
  Account,
  validateCredentialsList,
  MAX_AUTHORIZED_CREDENTIALS,
  isArray,
  isMPTAmount,
  isString,
  amountsEqual,
  areAddressesEqual,
  isSameAsset,
} from './common'
import type { TransactionMetadataBase } from './metadata'

/**
 * Enum representing values for Payment Transaction Flags.
 *
 * @category Transaction Flags
 */
export enum PaymentFlags {
  /**
   * Do not use the default path; only use paths included in the Paths field.
   * This is intended to force the transaction to take arbitrage opportunities.
   * Most clients do not need this.
   */
  tfNoRippleDirect = 0x00010000,
  /**
   * If the specified Amount cannot be sent without spending more than SendMax,
   * reduce the received amount instead of failing outright. See Partial.
   * Payments for more details.
   */
  tfPartialPayment = 0x00020000,
  /**
   * Only take paths where all the conversions have an input:output ratio that
   * is equal or better than the ratio of Amount:SendMax. See Limit Quality for
   * details.
   */
  tfLimitQuality = 0x00040000,
  /**
   * Indicates that the payment is creating a new account and the account's
   * reserve is being sponsored. Used in conjunction with XLS-68 sponsorship.
   */
  tfSponsorCreatedAccount = 0x00080000,
}

/**
 * Map of flags to boolean values representing {@link Payment} transaction
 * flags.
 *
 * @category Transaction Flags
 *
 * @example
 * ```typescript
 * const partialPayment: Payment = {
 *  TransactionType: 'Payment',
 *  Account: 'rM9WCfJU6udpFkvKThRaFHDMsp7L8rpgN',
 *  Amount: {
 *    currency: 'FOO',
 *    value: '4000',
 *    issuer: 'rPzwM2JfCSDjhbesdTCqFjWWdK7eFtTwZz',
 *  },
 *  Destination: 'rPzwM2JfCSDjhbesdTCqFjWWdK7eFtTwZz',
 *  Flags: {
 *    tfPartialPayment: true
 *  }
 * }
 *
 * // Autofill the tx to see how flags actually look compared to the interface usage.
 * const autofilledTx = await client.autofill(partialPayment)
 * console.log(autofilledTx)
 * // {
 * //  TransactionType: 'Payment',
 * //  Account: 'rM9WCfJU6udpFkvKThRaFHDMsp7L8rpgN',
 * //  Amount: {
 * //   currency: 'FOO',
 * //   value: '4000',
 * //   issuer: 'rPzwM2JfCSDjhbesdTCqFjWWdK7eFtTwZz'
 * //  },
 * //  Destination: 'rPzwM2JfCSDjhbesdTCqFjWWdK7eFtTwZz',
 * //  Flags: 131072,
 * //  Sequence: 21970996,
 * //  Fee: '12',
 * //  LastLedgerSequence: 21971016
 * // }
 * ```
 */
export interface PaymentFlagsInterface extends GlobalFlagsInterface {
  /**
   * Do not use the default path; only use paths included in the Paths field.
   * This is intended to force the transaction to take arbitrage opportunities.
   * Most clients do not need this.
   */
  tfNoRippleDirect?: boolean
  /**
   * If the specified Amount cannot be sent without spending more than SendMax,
   * reduce the received amount instead of failing outright. See Partial.
   * Payments for more details.
   */
  tfPartialPayment?: boolean
  /**
   * Only take paths where all the conversions have an input:output ratio that
   * is equal or better than the ratio of Amount:SendMax. See Limit Quality for
   * details.
   */
  tfLimitQuality?: boolean
  /**
   * Indicates that the payment is creating a new account and the account's
   * reserve is being sponsored. Used in conjunction with XLS-68 sponsorship.
   */
  tfSponsorCreatedAccount?: boolean
}

/**
 * A Payment transaction represents a transfer of value from one account to
 * another.
 *
 * @category Transaction Models
 */
export interface Payment extends BaseTransaction {
  TransactionType: 'Payment'
  /**
   * The amount of currency to deliver. For non-XRP amounts, the nested field
   * names MUST be lower-case. If the tfPartialPayment flag is set, deliver up
   * to this amount instead. An MPT amount must be greater than zero.
   */
  Amount: Amount | MPTAmount

  /**
   * API v2 alias of `Amount`. When both are present they must describe the
   * same amount; `autofill` copies `DeliverMax` into `Amount` and removes it.
   */
  DeliverMax?: Amount | MPTAmount

  /** The unique address of the account receiving the payment. */
  Destination: Account
  /**
   * Arbitrary tag that identifies the reason for the payment to the
   * destination, or a hosted recipient to pay.
   */
  DestinationTag?: number
  /**
   * Arbitrary 256-bit hash representing a specific reason or identifier for
   * this payment.
   */
  InvoiceID?: string
  /**
   * Array of payment paths to be used for this transaction. Must be omitted
   * for XRP-to-XRP transactions and for MPT payments, which are always direct.
   */
  Paths?: Path[]
  /**
   * Highest amount of source currency this transaction is allowed to cost,
   * including transfer fees, exchange rates, and slippage . Does not include
   * the XRP destroyed as a cost for submitting the transaction. For non-XRP
   * amounts, the nested field names MUST be lower-case. Must be supplied for
   * cross-currency/cross-issue payments. Must be omitted for XRP-to-XRP
   * Payments. For MPT payments it may only be the same MPT as `Amount`
   * (MPTs cannot be converted).
   */
  SendMax?: Amount | MPTAmount
  /**
   * Minimum amount of destination currency this transaction should deliver.
   * Only valid if this is a partial payment. For non-XRP amounts, the nested
   * field names are lower-case. For MPT payments it must be the same MPT as
   * `Amount`.
   */
  DeliverMin?: Amount | MPTAmount
  /**
   * Credentials associated with the sender of this transaction.
   * The credentials included must not be expired.
   */
  CredentialIDs?: string[]
  /**
   * The domain the sender intends to use. Both the sender and destination must
   * be part of this domain. The DomainID can be included if the sender intends
   * it to be a cross-currency payment (i.e. if the payment is going to interact
   * with the DEX). The domain will only play it's role if there is a path that
   * crossing an orderbook.
   *
   * Note: it's still possible that DomainID is included but the payment does
   * not interact with DEX, it simply means that the DomainID will be ignored
   * during payment paths.
   */
  DomainID?: string
  Flags?: number | PaymentFlagsInterface
}

export interface PaymentMetadata extends TransactionMetadataBase {
  DeliveredAmount?: Amount | MPTAmount
  delivered_amount?: Amount | MPTAmount | 'unavailable'
}

/**
 * Verify the form and type of a Payment at runtime.
 *
 * @param tx - A Payment Transaction.
 * @throws When the Payment is malformed.
 */
// eslint-disable-next-line max-lines-per-function -- lines required for validation
export function validatePayment(tx: Record<string, unknown>): void {
  validateBaseTransaction(tx)

  // DeliverMax is the API v2 alias of Amount; either one is required.
  if (tx.Amount === undefined && tx.DeliverMax === undefined) {
    throw new ValidationError('PaymentTransaction: missing field Amount')
  }

  if (tx.Amount !== undefined && !isAmount(tx.Amount)) {
    throw new ValidationError('PaymentTransaction: invalid Amount')
  }

  if (tx.DeliverMax !== undefined && !isAmount(tx.DeliverMax)) {
    throw new ValidationError('PaymentTransaction: invalid DeliverMax')
  }

  if (
    isAmount(tx.Amount) &&
    isAmount(tx.DeliverMax) &&
    !amountsEqual(tx.Amount, tx.DeliverMax)
  ) {
    throw new ValidationError(
      'PaymentTransaction: Amount and DeliverMax fields must be identical when both are provided',
    )
  }

  const amount = tx.Amount ?? tx.DeliverMax

  validateRequiredField(tx, 'Destination', isAccount)
  validateOptionalField(tx, 'DestinationTag', isNumber)

  validateCredentialsList(
    tx.CredentialIDs,
    tx.TransactionType,
    true,
    MAX_AUTHORIZED_CREDENTIALS,
  )

  if (tx.InvoiceID !== undefined && typeof tx.InvoiceID !== 'string') {
    throw new ValidationError('PaymentTransaction: InvoiceID must be a string')
  }

  validateOptionalField(tx, 'DomainID', isDomainID, {
    txType: 'PaymentTransaction',
    paramName: 'DomainID',
  })

  if (tx.Paths !== undefined && !isPaths(tx.Paths)) {
    throw new ValidationError('PaymentTransaction: invalid Paths')
  }

  if (tx.SendMax !== undefined && !isAmount(tx.SendMax)) {
    throw new ValidationError('PaymentTransaction: invalid SendMax')
  }

  checkPartialPayment(tx)
  checkSponsorCreatedAccount(tx)

  if (isAmount(amount)) {
    checkMPTPayment(tx, amount)
    checkSelfPayment(tx, amount)
  }
}

/**
 * MPT payments are always direct: rippled rejects Paths, a SendMax or
 * DeliverMin in a different asset (temMALFORMED), and a zero value
 * (temBAD_AMOUNT).
 *
 * @param tx - A Payment Transaction.
 * @param amount - The validated Amount (or DeliverMax) of the payment.
 * @throws When an MPT payment carries a field rippled rejects.
 */
function checkMPTPayment(
  tx: Record<string, unknown>,
  amount: Amount | MPTAmount,
): void {
  if (!isMPTAmount(amount)) {
    return
  }

  if (tx.Paths !== undefined) {
    throw new ValidationError(
      'PaymentTransaction: Paths are not allowed for MPT payments',
    )
  }

  if (isAmount(tx.SendMax) && !isSameAsset(tx.SendMax, amount)) {
    throw new ValidationError(
      'PaymentTransaction: SendMax must be the same MPT as Amount',
    )
  }

  if (isAmount(tx.DeliverMin) && !isSameAsset(tx.DeliverMin, amount)) {
    throw new ValidationError(
      'PaymentTransaction: DeliverMin must be the same MPT as Amount',
    )
  }

  if (Number(amount.value) === 0) {
    throw new ValidationError(
      'PaymentTransaction: MPT Amount must be greater than zero',
    )
  }
}

/**
 * A payment from an account to itself is redundant unless it converts
 * between assets, which needs Paths or a SendMax in a different asset.
 * rippled rejects it as temREDUNDANT.
 *
 * @param tx - A Payment Transaction.
 * @param amount - The validated Amount (or DeliverMax) of the payment.
 * @throws When Account and Destination are the same and no conversion is requested.
 */
function checkSelfPayment(
  tx: Record<string, unknown>,
  amount: Amount | MPTAmount,
): void {
  if (
    !isString(tx.Account) ||
    !isString(tx.Destination) ||
    !areAddressesEqual(tx.Account, tx.Destination)
  ) {
    return
  }

  const isConversion =
    tx.Paths !== undefined ||
    (isAmount(tx.SendMax) && !isSameCurrency(tx.SendMax, amount))

  if (!isConversion) {
    throw new ValidationError(
      'PaymentTransaction: Account and Destination cannot be the same unless SendMax or Paths make it a currency conversion',
    )
  }
}

/**
 * tfSponsorCreatedAccount marks a Payment that funds a new account whose reserve is
 * sponsored. rippled rejects it combined with tfNoRippleDirect/tfPartialPayment/
 * tfLimitQuality, with SendMax or Paths, or with a non-XRP Amount.
 *
 * @param tx - A Payment Transaction.
 * @throws When tfSponsorCreatedAccount is combined with an incompatible field or flag.
 */
function checkSponsorCreatedAccount(tx: Record<string, unknown>): void {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Only used by JS
  const flags = (tx.Flags ?? 0) as number | PaymentFlagsInterface
  const isTfSponsorCreatedAccount =
    typeof flags === 'number'
      ? isFlagEnabled(flags, PaymentFlags.tfSponsorCreatedAccount)
      : (flags.tfSponsorCreatedAccount ?? false)

  if (!isTfSponsorCreatedAccount) {
    return
  }

  const isTfNoRippleDirect =
    typeof flags === 'number'
      ? isFlagEnabled(flags, PaymentFlags.tfNoRippleDirect)
      : (flags.tfNoRippleDirect ?? false)
  const isTfPartialPayment =
    typeof flags === 'number'
      ? isFlagEnabled(flags, PaymentFlags.tfPartialPayment)
      : (flags.tfPartialPayment ?? false)
  const isTfLimitQuality =
    typeof flags === 'number'
      ? isFlagEnabled(flags, PaymentFlags.tfLimitQuality)
      : (flags.tfLimitQuality ?? false)

  if (isTfNoRippleDirect || isTfPartialPayment || isTfLimitQuality) {
    throw new ValidationError(
      'PaymentTransaction: tfSponsorCreatedAccount cannot be combined with tfNoRippleDirect, tfPartialPayment, or tfLimitQuality',
    )
  }

  if (tx.SendMax !== undefined || tx.Paths !== undefined) {
    throw new ValidationError(
      'PaymentTransaction: tfSponsorCreatedAccount cannot be combined with SendMax or Paths',
    )
  }

  if (typeof tx.Amount !== 'string') {
    throw new ValidationError(
      'PaymentTransaction: tfSponsorCreatedAccount requires a native XRP Amount',
    )
  }
}

function checkPartialPayment(tx: Record<string, unknown>): void {
  if (tx.DeliverMin != null) {
    if (tx.Flags == null) {
      throw new ValidationError(
        'PaymentTransaction: tfPartialPayment flag required with DeliverMin',
      )
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Only used by JS
    const flags = tx.Flags as number | PaymentFlagsInterface
    const isTfPartialPayment =
      typeof flags === 'number'
        ? isFlagEnabled(flags, PaymentFlags.tfPartialPayment)
        : (flags.tfPartialPayment ?? false)

    if (!isTfPartialPayment) {
      throw new ValidationError(
        'PaymentTransaction: tfPartialPayment flag required with DeliverMin',
      )
    }

    if (!isAmount(tx.DeliverMin)) {
      throw new ValidationError('PaymentTransaction: invalid DeliverMin')
    }
  }
}

/**
 * rippled's redundancy check compares currency codes only (issuers are
 * ignored), so mirror that here rather than using the stricter isSameAsset.
 *
 * @param amt1 - The first amount.
 * @param amt2 - The second amount.
 * @returns True if both amounts share a currency code (or MPT issuance).
 */
function isSameCurrency(
  amt1: Amount | MPTAmount,
  amt2: Amount | MPTAmount,
): boolean {
  if (typeof amt1 === 'string' || typeof amt2 === 'string') {
    return typeof amt1 === 'string' && typeof amt2 === 'string'
  }
  if (isMPTAmount(amt1) || isMPTAmount(amt2)) {
    return isSameAsset(amt1, amt2)
  }
  return amt1.currency === amt2.currency
}

function isPathStep(pathStep: Record<string, unknown>): boolean {
  if (pathStep.account !== undefined && typeof pathStep.account !== 'string') {
    return false
  }
  if (
    pathStep.currency !== undefined &&
    typeof pathStep.currency !== 'string'
  ) {
    return false
  }
  if (pathStep.issuer !== undefined && typeof pathStep.issuer !== 'string') {
    return false
  }
  if (
    pathStep.account !== undefined &&
    pathStep.currency === undefined &&
    pathStep.issuer === undefined
  ) {
    return true
  }
  if (pathStep.currency !== undefined || pathStep.issuer !== undefined) {
    return true
  }
  return false
}

function isPath(path: unknown): path is Path {
  if (!Array.isArray(path) || path.length === 0) {
    return false
  }
  for (const pathStep of path) {
    if (!isPathStep(pathStep)) {
      return false
    }
  }
  return true
}

function isPaths(paths: unknown): paths is Path[] {
  if (!isArray(paths) || paths.length === 0) {
    return false
  }

  for (const path of paths) {
    if (!isArray(path) || path.length === 0) {
      return false
    }

    if (!isPath(path)) {
      return false
    }
  }

  return true
}
