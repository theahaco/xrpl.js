import BigNumber from 'bignumber.js'

import { ValidationError } from '../errors'
import { MAX_MPT_AMOUNT } from '../models/transactions/common'

const BASE_TEN = 10
const MAX_ASSET_SCALE = 255
const INTEGER_CHECK = /^[0-9]+$/u

function checkAssetScale(name: string, assetScale: number): void {
  if (
    !Number.isInteger(assetScale) ||
    assetScale < 0 ||
    assetScale > MAX_ASSET_SCALE
  ) {
    throw new ValidationError(
      `${name}: assetScale must be an integer between 0 and ${MAX_ASSET_SCALE}, got ${String(
        assetScale,
      )}`,
    )
  }
}

function describe(value: BigNumber.Value): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

/**
 * Convert a decimal MPT amount to the integer `value` the ledger stores, using
 * the issuance's `AssetScale`.
 *
 * The MPT analogue of {@link xrpToDrops}: an issuance with `AssetScale: 2`
 * stores `'12.34'` as `'1234'`. The result is what goes in an
 * {@link MPTAmount}'s `value` (Payment `Amount`, Clawback `Amount`, ...).
 *
 * @param amount - The amount in whole tokens, as a string, number or BigNumber.
 * @param assetScale - The issuance's `AssetScale` (default 0: no fractional
 *   units).
 * @returns The integer unit count as a decimal string.
 * @throws {ValidationError} When the amount is not a number, is negative, has
 *   more decimal places than `assetScale` allows, or exceeds the maximum MPT
 *   amount (2^63 - 1 units).
 * @category Utilities
 */
export function mptToUnits(amount: BigNumber.Value, assetScale = 0): string {
  checkAssetScale('mptToUnits', assetScale)

  let value: BigNumber
  try {
    value = new BigNumber(amount)
  } catch (_err) {
    value = new BigNumber(Number.NaN)
  }
  if (!value.isFinite()) {
    throw new ValidationError(
      `mptToUnits: invalid value '${describe(amount)}', should be a BigNumber or string-encoded number.`,
    )
  }
  if (value.isNegative()) {
    throw new ValidationError(
      `mptToUnits: value '${describe(amount)}' must not be negative.`,
    )
  }

  const units = value.shiftedBy(assetScale)
  if (!units.isInteger()) {
    throw new ValidationError(
      `mptToUnits: value '${describe(
        amount,
      )}' has more than ${assetScale} decimal places.`,
    )
  }
  if (units.isGreaterThan(MAX_MPT_AMOUNT.toString())) {
    throw new ValidationError(
      `mptToUnits: value '${describe(
        amount,
      )}' exceeds the maximum MPT amount of ${MAX_MPT_AMOUNT.toString()} units.`,
    )
  }
  return units.toFixed(0)
}

/**
 * Convert the integer `value` of an MPT amount to a decimal amount, using the
 * issuance's `AssetScale`.
 *
 * The MPT analogue of {@link dropsToXrp}: an issuance with `AssetScale: 2`
 * reports a balance of `'1234'` for `12.34` tokens. The result is a string
 * (not a number) because MPT amounts go up to 2^63 - 1, beyond the precision
 * of a JavaScript number.
 *
 * @param units - The integer unit count (`MPTAmount.value`, `MPToken.MPTAmount`,
 *   `MPTokenIssuance.OutstandingAmount`, ...).
 * @param assetScale - The issuance's `AssetScale` (default 0).
 * @returns The amount in whole tokens as a decimal string.
 * @throws {ValidationError} When `units` is not a non-negative integer string
 *   (or number / BigNumber with an integer value).
 * @category Utilities
 */
export function unitsToMpt(units: BigNumber.Value, assetScale = 0): string {
  checkAssetScale('unitsToMpt', assetScale)

  const text =
    typeof units === 'string' ? units : new BigNumber(units).toFixed()
  if (!INTEGER_CHECK.test(text)) {
    throw new ValidationError(
      `unitsToMpt: invalid value '${describe(
        units,
      )}', should be a non-negative integer.`,
    )
  }
  return new BigNumber(text).shiftedBy(-assetScale).toString(BASE_TEN)
}
