import { ValidationError } from '../../errors'
import { ClawbackAmount } from '../common'

import {
  BaseTransaction,
  validateBaseTransaction,
  isIssuedCurrencyAmount,
  isMPTAmount,
  isAccount,
  validateOptionalField,
  isClawbackAmount,
  validateRequiredField,
  isMPTIssuer,
  tfUniversal,
  validateFlagsMask,
} from './common'

/**
 * Bits that are invalid in `Flags` of a Clawback transaction (rippled's
 * `tfClawbackMask`): the transaction defines no flags of its own, so only the
 * universal flags are allowed.
 */
// eslint-disable-next-line no-bitwise -- Need bitwise operations to replicate rippled behavior
export const tfClawbackMask = ~tfUniversal

/**
 * The Clawback transaction is used by the token issuer to claw back
 * issued tokens from a holder.
 */
export interface Clawback extends BaseTransaction {
  TransactionType: 'Clawback'
  /**
   * Indicates the AccountID that submitted this transaction. The account MUST
   * be the issuer of the currency or MPT.
   */
  Account: string
  /**
   * The amount of currency or MPT to clawback, and it must be non-XRP. The nested field
   * names MUST be lower-case. If the amount is IOU, the `issuer` field MUST be the holder's address,
   * whom to be clawed back.
   */
  Amount: ClawbackAmount
  /**
   * Indicates the AccountID that the issuer wants to clawback. This field is only valid for clawing back
   * MPTs.
   */
  Holder?: string
}

/**
 * Verify the form and type of an Clawback at runtime.
 *
 * @param tx - An Clawback Transaction.
 * @throws When the Clawback is Malformed.
 */
export function validateClawback(tx: Record<string, unknown>): void {
  validateBaseTransaction(tx)
  validateRequiredField(tx, 'Amount', isClawbackAmount)
  validateOptionalField(tx, 'Holder', isAccount)
  validateFlagsMask(tx, tfClawbackMask)

  if (!isIssuedCurrencyAmount(tx.Amount) && !isMPTAmount(tx.Amount)) {
    throw new ValidationError('Clawback: invalid Amount')
  }

  if (isIssuedCurrencyAmount(tx.Amount) && tx.Account === tx.Amount.issuer) {
    throw new ValidationError('Clawback: invalid holder Account')
  }

  if (isMPTAmount(tx.Amount) && tx.Account === tx.Holder) {
    throw new ValidationError('Clawback: invalid holder Account')
  }

  if (isIssuedCurrencyAmount(tx.Amount) && tx.Holder) {
    throw new ValidationError('Clawback: cannot have Holder for currency')
  }

  if (isMPTAmount(tx.Amount) && !tx.Holder) {
    throw new ValidationError('Clawback: missing Holder')
  }

  if (isMPTAmount(tx.Amount)) {
    // rippled: temBAD_AMOUNT for a zero MPT clawback.
    if (tx.Amount.value === '0') {
      throw new ValidationError(
        'Clawback: Amount value must be greater than zero',
      )
    }
    // Only the issuer (encoded in the ID) may claw back; rippled: tecNO_PERMISSION.
    if (!isMPTIssuer(tx.Account, tx.Amount.mpt_issuance_id)) {
      throw new ValidationError(
        'Clawback: Account must be the issuer of the MPTokenIssuanceID',
      )
    }
  }
}
