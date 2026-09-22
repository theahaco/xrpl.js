import BigNumber from 'bignumber.js'

import { ValidationError } from '../errors'
import { MAX_TRANSFER_FEE } from '../models/transactions/MPTokenIssuanceCreate'

const BASE_TEN = 10
const ONE_BILLION = '1000000000'
const TWO_BILLION = '2000000000'
// An MPT TransferFee is in increments of 0.001%, so one whole percent is 1000
// of them and the decimal 1 (i.e. 100%) is 100000 of them.
const MPT_TRANSFER_FEE_PER_PERCENT = 1000
const MPT_TRANSFER_FEE_PER_DECIMAL = 100000
const MAX_MPT_PERCENT = 50

function percentToDecimal(percent: string): string {
  if (!percent.endsWith('%')) {
    throw new ValidationError(`Value ${percent} must end with %`)
  }

  // Split the string on % and filter out any empty strings
  const split = percent.split('%').filter((str) => str !== '')
  if (split.length !== 1) {
    throw new ValidationError(`Value ${percent} contains too many % signs`)
  }

  try {
    return new BigNumber(split[0]).dividedBy('100').toString(BASE_TEN)
  } catch (_err) {
    throw new ValidationError(`Value is not a number`)
  }
}

/**
 * Converts a string decimal to "billionths" format for use with TransferRate.
 *
 * @param decimal - A string decimal between 0 and 1.00
 * @returns A number in the "billionths" format.
 * @throws ValidationError when the parameter is not convertible to
 * "billionths" format.
 * @category Utilities
 */
export function decimalToTransferRate(decimal: string): number {
  let rate: BigNumber
  try {
    rate = new BigNumber(decimal).times(ONE_BILLION).plus(ONE_BILLION)
  } catch (_err) {
    throw new ValidationError(`Value is not a number`)
  }

  if (rate.isLessThan(ONE_BILLION) || rate.isGreaterThan(TWO_BILLION)) {
    throw new ValidationError(`Decimal value must be between 0 and 1.00.`)
  }

  const billionths = rate.toString(BASE_TEN)

  if (billionths === ONE_BILLION) {
    return 0
  }

  if (billionths.includes('.')) {
    throw new ValidationError(`Decimal exceeds maximum precision.`)
  }

  return Number(billionths)
}

/**
 * Converts a string percent to "billionths" format for use with TransferRate.
 *
 * @param percent - A string percent between 0% and 100%.
 * @returns A number in the "billionths" format.
 * @throws ValidationError when the percent parameter is not convertible to
 * "billionths" format.
 * @category Utilities
 */
export function percentToTransferRate(percent: string): number {
  return decimalToTransferRate(percentToDecimal(percent))
}

/**
 * Converts a string decimal to the "billionths" format for use with QualityIn/
 * QualityOut
 *
 * @param decimal - A string decimal (i.e. ".00034").
 * @returns A number in the "billionths" format.
 * @throws ValidationError when the parameter is not convertible to
 * "billionths" format.
 * @category Utilities
 */
export function decimalToQuality(decimal: string): number {
  let rate: BigNumber
  try {
    rate = new BigNumber(decimal).times(ONE_BILLION)
  } catch (_err) {
    throw new ValidationError(`Value is not a number`)
  }

  const billionths = rate.toString(BASE_TEN)

  if (billionths.includes('-')) {
    throw new ValidationError('Cannot have negative Quality')
  }

  if (billionths === ONE_BILLION) {
    return 0
  }

  if (billionths.includes('.')) {
    throw new ValidationError(`Decimal exceeds maximum precision.`)
  }

  return Number(billionths)
}

/**
 * Converts a quality in "billionths" format to a decimal.
 *
 * @param quality - Quality to convert to decimal.
 * @returns decimal representation of quality.
 * @throws ValidationError when quality is not convertible to decimal format.
 * @category Utilities
 */
export function qualityToDecimal(quality: number): string {
  if (!Number.isInteger(quality)) {
    throw new ValidationError('Quality must be an integer')
  }

  if (quality < 0) {
    throw new ValidationError('Negative quality not allowed')
  }

  if (quality === 0) {
    return '1'
  }

  const decimal = new BigNumber(quality).dividedBy(ONE_BILLION)

  return decimal.toString(BASE_TEN)
}

/**
 * Converts a transfer rate in "billionths" format to a decimal.
 *
 * @param rate - TransferRate to convert to decimal.
 * @returns decimal representation of transfer Rate.
 * @throws ValidationError when it cannot convert from billionths format.
 * @category Utilities
 */
export function transferRateToDecimal(rate: number): string {
  if (!Number.isInteger(rate)) {
    throw new ValidationError(
      'Error decoding, transfer Rate must be an integer',
    )
  }

  if (rate === 0) {
    return '0'
  }

  const decimal = new BigNumber(rate).minus(ONE_BILLION).dividedBy(ONE_BILLION)

  if (decimal.isLessThan(0)) {
    throw new ValidationError('Error decoding, negative transfer rate')
  }

  return decimal.toString(BASE_TEN)
}

/**
 * Converts a string percent to the "billionths" format for use with QualityIn/
 * QualityOut
 *
 * @param percent - A string percent (i.e. ".034%").
 * @returns A number in the "billionths" format.
 * @throws ValidationError when the percent parameter is not convertible to
 * "billionths" format.
 * @category Utilities
 */
export function percentToQuality(percent: string): number {
  return decimalToQuality(percentToDecimal(percent))
}

/**
 * The maximum `TransferFee` an `MPTokenIssuanceCreate` accepts: 50000, i.e.
 * 50%. Re-exported from the transaction model so the MPT fee helpers and the
 * value they are bounded by live together.
 *
 * @category Utilities
 */
export const MAX_MPT_TRANSFER_FEE = MAX_TRANSFER_FEE

/**
 * Converts a string percent to the units an MPT `TransferFee` is denominated
 * in: increments of 0.001%, between 0 and {@link MAX_MPT_TRANSFER_FEE} (50%).
 *
 * MPT's `TransferFee` is *not* the "billionths" `TransferRate` an `AccountSet`
 * takes, so {@link percentToTransferRate} must not be used for it — this is the
 * MPT counterpart.
 *
 * @example
 * ```ts
 * percentToMPTTransferFee('1%') // 1000
 * percentToMPTTransferFee('0.5%') // 500
 * ```
 *
 * @param percent - A string percent between 0% and 50% (i.e. '0.75%'), with at
 * most three decimal places.
 * @returns A number of 0.001% increments, for `MPTokenIssuanceCreate.TransferFee`.
 * @throws ValidationError when the percent parameter is not convertible to an
 * MPT transfer fee.
 * @category Utilities
 */
export function percentToMPTTransferFee(percent: string): number {
  let fee: BigNumber
  try {
    fee = new BigNumber(percentToDecimal(percent)).times(
      MPT_TRANSFER_FEE_PER_DECIMAL,
    )
  } catch (_err) {
    throw new ValidationError(`Value is not a number`)
  }

  if (!fee.isFinite()) {
    throw new ValidationError(`Value is not a number`)
  }

  if (fee.isLessThan(0) || fee.isGreaterThan(MAX_MPT_TRANSFER_FEE)) {
    throw new ValidationError(
      `Percent value must be between 0% and ${MAX_MPT_PERCENT}%.`,
    )
  }

  if (!fee.isInteger()) {
    throw new ValidationError(`Decimal exceeds maximum precision.`)
  }

  return fee.toNumber()
}

/**
 * Converts an MPT `TransferFee` (increments of 0.001%) to the percent it
 * charges, as a decimal string without a `%` sign.
 *
 * @example
 * ```ts
 * mptTransferFeeToPercent(1000) // '1'
 * mptTransferFeeToPercent(500) // '0.5'
 * ```
 *
 * @param transferFee - An MPT `TransferFee`, between 0 and
 * {@link MAX_MPT_TRANSFER_FEE}.
 * @returns The percent the fee charges, i.e. '0.5' for 500.
 * @throws ValidationError when the transfer fee is not a valid MPT
 * `TransferFee`.
 * @category Utilities
 */
export function mptTransferFeeToPercent(transferFee: number): string {
  if (!Number.isInteger(transferFee)) {
    throw new ValidationError('MPT TransferFee must be an integer')
  }

  if (transferFee < 0 || transferFee > MAX_MPT_TRANSFER_FEE) {
    throw new ValidationError(
      `MPT TransferFee must be between 0 and ${MAX_MPT_TRANSFER_FEE}`,
    )
  }

  return new BigNumber(transferFee)
    .dividedBy(MPT_TRANSFER_FEE_PER_PERCENT)
    .toString(BASE_TEN)
}
