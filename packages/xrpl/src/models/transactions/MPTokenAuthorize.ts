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
 *
 * ## Compliance controls: banning and freezing holders
 *
 * XLS-33 has no deny-list, and nothing can be written on-ledger about an
 * address before that address has opted in. "Ban this address before it ever
 * holds the token" therefore has no single on-ledger representation; the ledger
 * offers three partial mechanisms:
 *
 * | Goal | Mechanism |
 * | --- | --- |
 * | Never let an address receive | `lsfMPTRequireAuth` and never authorize that address |
 * | Freeze an address once it has opted in | `MPTokenIssuanceSet` with `Holder` and `tfMPTLock` |
 * | Admit by credential instead | `DomainID` on the issuance (XLS-80) plus credentials (XLS-70) |
 *
 * Their limits:
 * - Allow-listing is the only pre-emptive guarantee, and it is implicit: no
 *   ledger entry records the decision, so the issuer needs an off-ledger
 *   registry and a guard in front of every `MPTokenAuthorize` with `Holder`.
 * - Opt-in cannot be prevented: any funded account can create an MPToken for
 *   any issuance. Under `lsfMPTRequireAuth` that entry is inert (`tecNO_AUTH`
 *   on every payment), but it exists and it counts toward the holder's reserve.
 * - A per-holder lock needs the holder's MPToken to exist (`tecOBJECT_NOT_FOUND`
 *   before). It is the closest thing to a persistent ban: it works on a
 *   zero-balance, unauthorized entry, survives a later (mistaken) authorization
 *   because `tecLOCKED` takes precedence over `tecNO_AUTH`, and blocks payments
 *   between holders in both directions. Payments to and from the issuer and
 *   `Clawback` still succeed, and the locked holder can never delete its entry.
 * - Revoking a credential (`CredentialDelete`) blocks the holder's sends and
 *   receives, including redemption, but does not lock or claw back. The route
 *   is not pre-emptive either (a never-issued credential is the same implicit
 *   state as never authorizing), there is no per-address deny-list inside a
 *   domain, and `DomainID` cannot be combined with `Holder`.
 * - rippled cannot enumerate an issuance's holders (`mpt_holders` is served by
 *   Clio only), so "lock on arrival" means polling `ledger_entry` for the
 *   `mptoken` of each banned address and locking it once it appears.
 * - To ban a current holder, lock its MPToken and then `Clawback` the balance;
 *   both work while the holder is locked, unauthorized, or globally locked.
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
   *
   * @remarks The holder's MPToken must already exist: authorizing an address that
   * has not opted in fails with `tecOBJECT_NOT_FOUND`, so an address cannot be
   * pre-approved (or pre-banned) on-ledger. See the "Compliance controls" section
   * on {@link MPTokenAuthorize}.
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
