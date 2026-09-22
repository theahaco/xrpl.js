import {
  BaseTransaction,
  isString,
  validateBaseTransaction,
  validateRequiredField,
  Account,
  validateOptionalField,
  isAccount,
  GlobalFlagsInterface,
} from './common'

/**
 * Transaction Flags for an MPTokenAuthorize Transaction.
 *
 * @category Transaction Flags
 */
export enum MPTokenAuthorizeFlags {
  /**
   * The meaning depends on who submits the transaction:
   * - Submitted by a holder (no `Holder` field): the holder opts out and its
   *   MPToken entry is deleted, releasing the reserve. Fails with
   *   `tecHAS_OBLIGATIONS` if the balance is non-zero and with `tecNO_PERMISSION`
   *   if the entry is locked (even at zero balance), so a locked holder cannot
   *   leave until the issuer unlocks it.
   * - Submitted by the issuer (with `Holder`): revokes authorization by clearing
   *   `lsfMPTAuthorized` on that holder's MPToken (allow-listing under
   *   `lsfMPTRequireAuth`). The balance is untouched, but every payment involving
   *   the holder, including redemption to the issuer and issuer-to-holder
   *   payments, fails with `tecNO_AUTH` until re-authorized. This is stricter
   *   than a lock, and it does not clear an existing lock.
   */
  tfMPTUnauthorize = 0x00000001,
}

/**
 * Map of flags to boolean values representing {@link MPTokenAuthorize} transaction
 * flags.
 *
 * @category Transaction Flags
 */
export interface MPTokenAuthorizeFlagsInterface extends GlobalFlagsInterface {
  /**
   * Holder: opt out and delete the MPToken entry. Issuer (with `Holder`): revoke
   * that holder's authorization. See {@link MPTokenAuthorizeFlags.tfMPTUnauthorize}.
   */
  tfMPTUnauthorize?: boolean
}

/**
 * The MPTokenAuthorize transaction has two roles depending on who submits it:
 * - A prospective holder (no `Holder` field) opts in: this creates the holder's
 *   MPToken entry (owner reserve applies) and is required before the holder can
 *   receive the token. The issuer cannot prevent an opt-in; a second opt-in fails
 *   with `tecDUPLICATE`. With `tfMPTUnauthorize` the holder opts out and the
 *   entry is deleted (the balance must be zero and the entry must not be locked).
 * - The issuer (with `Holder`) authorizes that holder's existing entry by setting
 *   `lsfMPTAuthorized`, which the holder needs in order to send or receive when
 *   the issuance has `lsfMPTRequireAuth`. With `tfMPTUnauthorize` the issuer
 *   revokes authorization: the balance is untouched but the holder can no longer
 *   send or receive, not even to the issuer (`tecNO_AUTH`).
 *
 * The issuer cannot authorize or unauthorize an address that has not opted in
 * (`tecOBJECT_NOT_FOUND`), and cannot use this transaction on an issuance without
 * `lsfMPTRequireAuth` (`tecNO_AUTH`). Authorization and locking are independent
 * bits: a holder that is both authorized and locked is still locked (`tecLOCKED`).
 * The issuer submitting without `Holder`, or a non-issuer submitting with `Holder`,
 * fails with `tecNO_PERMISSION`.
 */
export interface MPTokenAuthorize extends BaseTransaction {
  TransactionType: 'MPTokenAuthorize'
  /**
   * Identifies the MPTokenIssuance
   */
  MPTokenIssuanceID: string
  /**
   * Only valid when the sender is the issuer: the address of the holder whose
   * existing MPToken entry to authorize (or, with `tfMPTUnauthorize`,
   * unauthorize). Must differ from `Account`. Omit it when a holder is opting in
   * to or out of the token on its own behalf.
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
  validateRequiredField(tx, 'MPTokenIssuanceID', isString)
  validateOptionalField(tx, 'Holder', isAccount)
}
