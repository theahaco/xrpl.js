import { BaseLedgerEntry, HasPreviousTxnID } from './BaseLedgerEntry'

/**
 * An MPToken object represents one account's holding of a Multi-Purpose
 * Token (MPT) issuance, including its balance and per-holder flags such
 * as authorized and locked.
 *
 * @category Ledger Entries
 */
export interface MPToken extends BaseLedgerEntry, HasPreviousTxnID {
  LedgerEntryType: 'MPToken'
  /** The 192-bit `MPTokenIssuanceID` (48 hex characters) of the issuance this holding belongs to. */
  MPTokenIssuanceID: string
  /**
   * The holder's balance, as an integer in fractional units of the
   * issuance's `AssetScale`.
   */
  MPTAmount: string
  Flags: number
  OwnerNode?: string
  /**
   * The amount of this holder's balance, in fractional units of the
   * issuance's `AssetScale`, that is currently held in Escrow (XLS-85
   * token escrow). Absent when nothing is escrowed.
   */
  LockedAmount?: string
  /** ElGamal ciphertext of the holder's pending confidential inbox balance. */
  ConfidentialBalanceInbox?: string
  /** ElGamal ciphertext of the holder's spendable confidential balance. */
  ConfidentialBalanceSpending?: string
  /** Version counter for the holder's confidential balance state. */
  ConfidentialBalanceVersion?: number
  /** ElGamal ciphertext of the holder's confidential balance under the issuer's key. */
  IssuerEncryptedBalance?: string
  /** ElGamal ciphertext of the holder's confidential balance under the auditor's key. */
  AuditorEncryptedBalance?: string
  /** The holder's registered compressed ElGamal encryption key. */
  HolderEncryptionKey?: string
  /**
   * (Optional) The account sponsoring the reserve for this MPToken. If
   * present, the sponsor is responsible for the reserve requirement of this
   * object instead of the owner.
   */
  Sponsor?: string
}
