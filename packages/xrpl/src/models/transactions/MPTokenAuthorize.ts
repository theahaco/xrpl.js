import { ValidationError } from '../../errors'

import {
  BaseTransaction,
  validateBaseTransaction,
  validateRequiredField,
  Account,
  validateOptionalField,
  isAccount,
  GlobalFlagsInterface,
  isMPTokenIssuanceID,
  isMPTIssuer,
  tfUniversal,
  validateFlagsMask,
} from './common'

/**
 * Transaction Flags for an MPTokenAuthorize Transaction.
 *
 * @category Transaction Flags
 */
export enum MPTokenAuthorizeFlags {
  /**
   * If set and transaction is submitted by a holder, it indicates that the holder no
   * longer wants to hold the MPToken, which will be deleted as a result. If the the holder's
   * MPToken has non-zero balance while trying to set this flag, the transaction will fail. On
   * the other hand, if set and transaction is submitted by an issuer, it would mean that the
   * issuer wants to unauthorize the holder (only applicable for allow-listing),
   * which would unset the lsfMPTAuthorized flag on the MPToken.
   */
  tfMPTUnauthorize = 0x00000001,
}

/**
 * Bits that are invalid in `Flags` of an MPTokenAuthorize transaction
 * (rippled's `tfMPTokenAuthorizeMask`): everything except the universal
 * flags and `tfMPTUnauthorize`.
 */
/* eslint-disable no-bitwise -- Need bitwise operations to replicate rippled behavior */
export const tfMPTokenAuthorizeMask = ~(
  tfUniversal | MPTokenAuthorizeFlags.tfMPTUnauthorize
)
/* eslint-enable no-bitwise */

/**
 * Map of flags to boolean values representing {@link MPTokenAuthorize} transaction
 * flags.
 *
 * @category Transaction Flags
 */
export interface MPTokenAuthorizeFlagsInterface extends GlobalFlagsInterface {
  tfMPTUnauthorize?: boolean
}

/**
 * The MPTokenAuthorize transaction is used to globally lock/unlock a MPTokenIssuance,
 * or lock/unlock an individual's MPToken.
 */
export interface MPTokenAuthorize extends BaseTransaction {
  TransactionType: 'MPTokenAuthorize'
  /**
   * Identifies the MPTokenIssuance
   */
  MPTokenIssuanceID: string
  /**
   * An optional XRPL Address of an individual token holder balance to lock/unlock.
   * If omitted, this transaction will apply to all any accounts holding MPTs.
   */
  Holder?: Account
  Flags?: number | MPTokenAuthorizeFlagsInterface
}

/**
 * Verify the form and type of an MPTokenAuthorize at runtime.
 *
 * @param tx - An MPTokenAuthorize Transaction.
 * @throws When the MPTokenAuthorize is Malformed.
 */
export function validateMPTokenAuthorize(tx: Record<string, unknown>): void {
  validateBaseTransaction(tx)
  validateRequiredField(tx, 'MPTokenIssuanceID', isMPTokenIssuanceID)
  validateOptionalField(tx, 'Holder', isAccount)
  validateFlagsMask(tx, tfMPTokenAuthorizeMask)

  if (tx.Holder != null && tx.Holder === tx.Account) {
    throw new ValidationError(
      'MPTokenAuthorize: Holder cannot be the same as the Account.',
    )
  }

  // The issuer is encoded in the MPTokenIssuanceID, so which side of the
  // authorization this is can be decided offline: the issuer (un)authorizes a
  // Holder; a holder opts in or out of its own MPToken and never names one.
  // rippled answers both mismatches with tecNO_PERMISSION (a fee-charging tec).
  const isIssuer = isMPTIssuer(tx.Account, tx.MPTokenIssuanceID)
  if (isIssuer && tx.Holder == null) {
    throw new ValidationError(
      'MPTokenAuthorize: the issuer of the MPTokenIssuanceID must specify Holder',
    )
  }
  if (!isIssuer && tx.Holder != null) {
    throw new ValidationError(
      'MPTokenAuthorize: only the issuer of the MPTokenIssuanceID may specify Holder',
    )
  }
}
