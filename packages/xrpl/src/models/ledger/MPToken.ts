import { BaseLedgerEntry, HasPreviousTxnID } from './BaseLedgerEntry'

/**
 * An MPToken object represents one account's holding of one Multi-Purpose
 * Token issuance. It is created by MPTokenAuthorize (or by the first payment
 * of the token to the holder) and deleted when the holder's balance is zero
 * and they de-authorize.
 *
 * @category Ledger Entries
 */
export interface MPToken extends BaseLedgerEntry, HasPreviousTxnID {
  LedgerEntryType: 'MPToken'
  /** The address of the account that holds this MPToken. */
  Account: string
  /** The 192-bit MPTokenIssuanceID of the issuance this MPToken belongs to. */
  MPTokenIssuanceID: string
  /**
   * The holder's balance, in the issuance's fractional units. This field is
   * omitted by rippled when the balance is zero (for example on a holder that
   * has only authorized, or one whose balance has been fully clawed back).
   */
  MPTAmount?: string
  /**
   * A bit-map of boolean `lsfMPT*` flags. Use `parseMPTokenFlags` to read it
   * as an {@link MPTokenFlagsInterface}.
   */
  Flags: number
  /**
   * A hint indicating which page of the holder's owner directory links to
   * this object, in case the directory consists of multiple pages.
   */
  OwnerNode: string
  /**
   * The amount of this holder's balance that is currently locked in Escrow or
   * PaymentChannel objects.
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

export interface MPTokenFlagsInterface {
  /**
   * The holder's balance is locked by the issuer; payments of this MPT to or
   * from the holder fail with `tecLOCKED`.
   */
  lsfMPTLocked?: boolean
  /**
   * The issuer has authorized this holder via MPTokenAuthorize. Required for
   * the holder to receive or send the token when the issuance has
   * `lsfMPTRequireAuth` set.
   */
  lsfMPTAuthorized?: boolean
}

export enum MPTokenFlags {
  lsfMPTLocked = 0x00000001,
  lsfMPTAuthorized = 0x00000002,
}
