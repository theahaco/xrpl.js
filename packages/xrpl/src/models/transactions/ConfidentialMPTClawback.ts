import { ValidationError } from '../../errors'

import {
  Account,
  BaseTransaction,
  isAccount,
  isMPTIssuer,
  isHexWithByteLength,
  isString,
  validateBaseTransaction,
  validateRequiredField,
  validateConfidentialMPTAmount,
  CONFIDENTIAL_CLAWBACK_PROOF_BYTES,
} from './common'

/**
 * The ConfidentialMPTClawback transaction lets an issuer claw back a holder's
 * confidential (encrypted) MPT balance (XLS-96). It is all-or-nothing: rippled
 * always burns the holder's entire confidential balance. The `ZKProof` is built
 * against the holder's issuer-encrypted balance, so the issuer needs the ElGamal
 * keypair whose public key it registered as `IssuerEncryptionKey`. The holder's
 * transparent balance is not affected; use the plain `Clawback` transaction for
 * that. Use {@link prepareConfidentialClawback} to build this transaction.
 *
 * @category Transaction Models
 */
export interface ConfidentialMPTClawback extends BaseTransaction {
  TransactionType: 'ConfidentialMPTClawback'
  /**
   * Identifies the MPTokenIssuance being clawed back.
   */
  MPTokenIssuanceID: string
  /** The XRPL Address of the holder whose confidential balance is clawed back. */
  Holder: Account
  /**
   * The holder's entire confidential balance, as a decimal string. Confidential
   * clawback is all-or-nothing: this must equal the full balance, because the
   * `ZKProof` binds it to the holder's issuer-encrypted balance ciphertext. A
   * smaller value does not claw back a partial amount; it produces a proof that
   * rippled rejects (`tecBAD_PROOF`).
   */
  MPTAmount: string
  /**
   * The zero-knowledge proof authorizing the clawback against the holder's
   * confidential balance.
   */
  ZKProof: string
}

/**
 * Verify the form and type of a ConfidentialMPTClawback at runtime.
 *
 * @param tx - A ConfidentialMPTClawback Transaction.
 * @throws When the ConfidentialMPTClawback is malformed.
 */
export function validateConfidentialMPTClawback(
  tx: Record<string, unknown>,
): void {
  validateBaseTransaction(tx)
  validateRequiredField(tx, 'MPTokenIssuanceID', isString)
  // rippled requires the submitter to be the issuer of the MPToken (temMALFORMED).
  if (!isMPTIssuer(tx.Account, tx.MPTokenIssuanceID)) {
    throw new ValidationError(
      'ConfidentialMPTClawback: Account must be the issuer of the MPTokenIssuanceID',
    )
  }
  validateRequiredField(tx, 'Holder', isAccount)
  if (tx.Account === tx.Holder) {
    throw new ValidationError(
      'ConfidentialMPTClawback: Holder and Account must be different',
    )
  }
  validateConfidentialMPTAmount(tx, false)
  validateRequiredField(
    tx,
    'ZKProof',
    isHexWithByteLength(CONFIDENTIAL_CLAWBACK_PROOF_BYTES),
  )
}
