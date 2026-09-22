import { ValidationError } from '../../errors'
import { isFlagEnabled, isHex } from '../utils'
// eslint-disable-next-line import/no-cycle -- this method is needed to convert txn flags to number
import { convertTxFlagsToNumber } from '../utils/flags'
import {
  MAX_MPT_META_BYTE_LENGTH,
  MPT_META_WARNING_HEADER,
  validateMPTokenMetadata,
} from '../utils/mptokenMetadata'

import {
  BaseTransaction,
  isString,
  validateBaseTransaction,
  validateRequiredField,
  Account,
  validateOptionalField,
  isAccount,
  GlobalFlagsInterface,
  isNumber,
  isDomainID,
  isHexWithByteLength,
  CONFIDENTIAL_EC_POINT_BYTES,
} from './common'
import {
  MAX_TRANSFER_FEE,
  tifMPTokenIssuanceImmutableMask,
} from './MPTokenIssuanceCreate'

import type { Transaction } from '.'

/**
 * Transaction Flags for an MPTokenIssuanceSet Transaction.
 *
 * @category Transaction Flags
 */
export enum MPTokenIssuanceSetFlags {
  /**
   * Locks the MPT. With `Holder`, sets `lsfMPTLocked` on that holder's MPToken;
   * without `Holder`, sets `lsfMPTLocked` on the issuance itself (global lock).
   * Requires `lsfMPTCanLock` on the issuance.
   *
   * Effect on payments, for both kinds of lock: payments between holders fail
   * with `tecLOCKED`, but payments to and from the issuer (issuance and
   * redemption) still succeed. A lock does not stop `Clawback`. Locking is
   * independent of authorization: authorizing or unauthorizing a holder leaves
   * its lock in place, and `tecLOCKED` takes precedence over `tecNO_AUTH`. A
   * locked holder cannot delete its own zero-balance MPToken (`tecNO_PERMISSION`),
   * so its reserve stays pinned until unlocked. A payment from a holder with a
   * zero balance fails with `tecPATH_PARTIAL` before the lock is checked.
   *
   * Idempotent: locking an already-locked target succeeds (`tesSUCCESS`), so
   * read the ledger entry to tell "already locked" from "just locked".
   */
  tfMPTLock = 0x00000001,
  /**
   * Unlocks the MPT. With `Holder`, clears `lsfMPTLocked` on that holder's
   * MPToken; without `Holder`, clears the global lock on the issuance. A global
   * unlock does not clear per-holder locks, and vice versa. Idempotent: unlocking
   * an already-unlocked target succeeds (`tesSUCCESS`).
   */
  tfMPTUnlock = 0x00000002,
  /**
   * Sets the `lsfMPTCanLock` flag. Enables the token to be locked both individually and globally. (XLS-94D)
   * One-way: once enabled, the capability cannot be disabled again.
   */
  tfMPTSetCanLock = 0x00000004,
  /**
   * Sets the `lsfMPTRequireAuth` flag. Requires individual holders to be authorized. (XLS-94D)
   * One-way: once enabled, the capability cannot be disabled again.
   */
  tfMPTSetRequireAuth = 0x00000008,
  /**
   * Sets the `lsfMPTCanEscrow` flag. Allows holders to place balances into escrow. (XLS-94D)
   * One-way: once enabled, the capability cannot be disabled again.
   */
  tfMPTSetCanEscrow = 0x00000010,
  /**
   * Sets the `lsfMPTCanTrade` flag. Allows holders to trade balances on the XRPL DEX. (XLS-94D)
   * One-way: once enabled, the capability cannot be disabled again.
   */
  tfMPTSetCanTrade = 0x00000020,
  /**
   * Sets the `lsfMPTCanTransfer` flag. Allows tokens to be transferred to non-issuer accounts. (XLS-94D)
   * One-way: once enabled, the capability cannot be disabled again.
   */
  tfMPTSetCanTransfer = 0x00000040,
  /**
   * Sets the `lsfMPTCanClawback` flag. Enables the issuer to claw back tokens
   * via `Clawback` or `AMMClawback` transactions. (XLS-94D)
   * One-way: once enabled, the capability cannot be disabled again.
   */
  tfMPTSetCanClawback = 0x00000080,
  /**
   * Sets the `lsfMPTCanHoldConfidentialBalance` flag. Enables the token to be held
   * in a confidential balance. (XLS-96 Confidential MPT)
   * One-way: once enabled, the capability cannot be disabled again.
   * Once holders move funds into a confidential balance, the plain `Clawback`
   * transaction no longer reaches those funds: a confidential balance can only be
   * recovered with `ConfidentialMPTClawback`, which burns all of it. Cannot be
   * enabled in the same transaction as a non-zero `TransferFee`.
   */
  tfMPTSetCanHoldConfidentialBalance = 0x00000100,
}

/* eslint-disable no-bitwise -- Need bitwise operations to replicate rippled behavior */
/**
 * The set of capability-setting `tfMPTSet*` flags. These one-way flags enable
 * the corresponding capability on the MPTokenIssuance ledger object; once
 * enabled, a capability cannot be disabled via a subsequent MPTokenIssuanceSet.
 */
export const tfMPTokenIssuanceSetEnableFlagMask =
  MPTokenIssuanceSetFlags.tfMPTSetCanLock |
  MPTokenIssuanceSetFlags.tfMPTSetRequireAuth |
  MPTokenIssuanceSetFlags.tfMPTSetCanEscrow |
  MPTokenIssuanceSetFlags.tfMPTSetCanTrade |
  MPTokenIssuanceSetFlags.tfMPTSetCanTransfer |
  MPTokenIssuanceSetFlags.tfMPTSetCanClawback |
  MPTokenIssuanceSetFlags.tfMPTSetCanHoldConfidentialBalance
/* eslint-enable no-bitwise */

/**
 * Map of flags to boolean values representing {@link MPTokenIssuanceSet} transaction
 * flags.
 *
 * @category Transaction Flags
 */
export interface MPTokenIssuanceSetFlagsInterface extends GlobalFlagsInterface {
  /**
   * Lock one holder (with `Holder`) or every holder (without). Payments between
   * holders fail with `tecLOCKED`; payments to and from the issuer and `Clawback`
   * still succeed. See {@link MPTokenIssuanceSetFlags.tfMPTLock}.
   */
  tfMPTLock?: boolean
  /**
   * Unlock one holder (with `Holder`) or clear the global lock (without).
   * See {@link MPTokenIssuanceSetFlags.tfMPTUnlock}.
   */
  tfMPTUnlock?: boolean
  /**
   * Sets the `lsfMPTCanLock` flag. Enables the token to be locked both
   * individually and globally. One-way: once enabled, the capability cannot be
   * disabled again.
   */
  tfMPTSetCanLock?: boolean
  /**
   * Sets the `lsfMPTRequireAuth` flag. Requires individual holders to be
   * authorized. One-way: once enabled, the capability cannot be disabled again.
   */
  tfMPTSetRequireAuth?: boolean
  /**
   * Sets the `lsfMPTCanEscrow` flag. Allows holders to place balances into
   * escrow. One-way: once enabled, the capability cannot be disabled again.
   */
  tfMPTSetCanEscrow?: boolean
  /**
   * Sets the `lsfMPTCanTrade` flag. Allows holders to trade balances on the XRPL
   * DEX. One-way: once enabled, the capability cannot be disabled again.
   */
  tfMPTSetCanTrade?: boolean
  /**
   * Sets the `lsfMPTCanTransfer` flag. Allows tokens to be transferred to
   * non-issuer accounts. One-way: once enabled, the capability cannot be
   * disabled again.
   */
  tfMPTSetCanTransfer?: boolean
  /**
   * Sets the `lsfMPTCanClawback` flag. Enables the issuer to claw back tokens
   * via `Clawback` or `AMMClawback` transactions. One-way: once enabled, the
   * capability cannot be disabled again.
   */
  tfMPTSetCanClawback?: boolean
  /**
   * Sets the `lsfMPTCanHoldConfidentialBalance` flag. Enables the token to be
   * held in a confidential balance. (XLS-96 Confidential MPT) One-way: once
   * enabled, the capability cannot be disabled again.
   * See {@link MPTokenIssuanceSetFlags.tfMPTSetCanHoldConfidentialBalance} for
   * the consequence for `Clawback`.
   */
  tfMPTSetCanHoldConfidentialBalance?: boolean
}

/**
 * The MPTokenIssuanceSet transaction lets the issuer change an existing
 * MPTokenIssuance. One transaction performs one kind of change:
 * - Lock or unlock (`tfMPTLock` / `tfMPTUnlock`): every holder when `Holder` is
 *   omitted (a global lock on the issuance), or a single holder's MPToken when
 *   `Holder` is set. Under either kind of lock, payments between holders fail
 *   with `tecLOCKED` while payments to and from the issuer, and `Clawback`,
 *   still succeed.
 * - Enable a capability with a `tfMPTSet*` flag (XLS-94D DynamicMPT). This is
 *   one-way: once enabled, a capability cannot be disabled again. Pinning a bit
 *   in `ImmutableFlags` (at create time or here) prevents it from ever being
 *   enabled (`tecNO_PERMISSION`).
 * - Mutate `MPTokenMetadata` or `TransferFee`, or add `ImmutableFlags` bits
 *   (XLS-94D).
 * - Set `DomainID` to gate holders by permissioned domain (XLS-80).
 * - Register `IssuerEncryptionKey` / `AuditorEncryptionKey` for confidential
 *   balances (XLS-96).
 *
 * `Holder` is only valid together with `tfMPTLock` or `tfMPTUnlock`; it cannot be
 * combined with a `tfMPTSet*` flag, a mutation field, `DomainID` or an encryption
 * key. A lock/unlock cannot be combined with a mutation either.
 */
export interface MPTokenIssuanceSet extends BaseTransaction {
  TransactionType: 'MPTokenIssuanceSet'
  /**
   * Identifies the MPTokenIssuance
   */
  MPTokenIssuanceID: string
  /**
   * The address of a single holder whose MPToken to lock or unlock. Only valid
   * together with `tfMPTLock` or `tfMPTUnlock`, and must differ from `Account`.
   * If omitted, the lock/unlock applies to the issuance as a whole (every
   * holder). Cannot be combined with any other kind of change.
   *
   * @remarks The holder's MPToken must already exist: locking an address that
   * has not opted in via MPTokenAuthorize fails with `tecOBJECT_NOT_FOUND`, so
   * a lock cannot be placed pre-emptively. A lock does work on a zero-balance,
   * unauthorized entry and survives a later authorization, which makes
   * "lock on arrival" the closest thing to a persistent per-address ban. See
   * the "Compliance controls" section on {@link MPTokenAuthorize}.
   */
  Holder?: Account
  /**
   * The issuer's compressed ElGamal encryption key (33-byte EC point),
   * registered so confidential amounts can be encrypted to the issuer.
   */
  IssuerEncryptionKey?: string
  /**
   * The auditor's compressed ElGamal encryption key (33-byte EC point),
   * registered so confidential amounts can be encrypted to an auditor.
   */
  AuditorEncryptionKey?: string
  Flags?: number | MPTokenIssuanceSetFlagsInterface

  /**
   * New metadata to replace the existing value, in hex format (max 1024 bytes).
   * The transaction will be rejected if `lsifMPTMetadata` has been set in
   * `ImmutableFlags`. Setting an empty `MPTokenMetadata` removes the field.
   * Should follow the
   * {@link https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0089-multi-purpose-token-metadata-schema | XLS-89} standard.
   */
  MPTokenMetadata?: string
  /**
   * New transfer fee value, between 0 and 50,000 inclusive (in increments of
   * 0.001%). The transaction will be rejected if `lsifMPTTransferFee` has been
   * set in `ImmutableFlags`. A non-zero value requires `lsfMPTCanTransfer` to
   * already be set on the ledger, or to be enabled by this same transaction via
   * `tfMPTSetCanTransfer`. Setting `TransferFee` to zero removes the field.
   */
  TransferFee?: number
  /**
   * Declares which fields or flags are immutable, via a bitmask of
   * {@link MPTokenIssuanceCreateImmutableFlags} (`tif*`). Once a bit is set, the
   * corresponding field or flag can never be set or modified again. The
   * `ImmutableFlags` provided here are added to the current ledger object's
   * `ImmutableFlags`; it is not a complete replacement. (XLS-94D)
   */
  ImmutableFlags?: number
  /**
   * The PermissionedDomain object ID that gates who may hold this MPT (XLS-80).
   * Requires `lsfMPTRequireAuth` on the issuance (`tecNO_PERMISSION` otherwise);
   * the zero hash clears an existing domain. Cannot be set together with the
   * `Holder` field. Admission by credential replaces per-holder
   * MPTokenAuthorize; revoking a holder's credential blocks its sends and
   * receives (including redemption) but does not lock or claw back, and there
   * is no per-address deny-list inside a domain. See the "Compliance controls"
   * section on {@link MPTokenAuthorize}.
   */
  DomainID?: string
}

/* eslint-disable max-lines-per-function, max-statements -- All validation rules are needed */
/**
 * Verify the form and type of an MPTokenIssuanceSet at runtime.
 *
 * @param tx - An MPTokenIssuanceSet Transaction.
 * @throws When the MPTokenIssuanceSet is Malformed.
 */
export function validateMPTokenIssuanceSet(tx: Record<string, unknown>): void {
  validateBaseTransaction(tx)
  validateRequiredField(tx, 'MPTokenIssuanceID', isString)
  validateOptionalField(tx, 'Holder', isAccount)
  validateOptionalField(
    tx,
    'IssuerEncryptionKey',
    isHexWithByteLength(CONFIDENTIAL_EC_POINT_BYTES),
  )
  validateOptionalField(
    tx,
    'AuditorEncryptionKey',
    isHexWithByteLength(CONFIDENTIAL_EC_POINT_BYTES),
  )
  if (tx.AuditorEncryptionKey != null && tx.IssuerEncryptionKey == null) {
    throw new ValidationError(
      'MPTokenIssuanceSet: AuditorEncryptionKey requires IssuerEncryptionKey',
    )
  }
  validateOptionalField(tx, 'MPTokenMetadata', isString)
  validateOptionalField(tx, 'TransferFee', isNumber)
  validateOptionalField(tx, 'ImmutableFlags', isNumber)
  validateOptionalField(tx, 'DomainID', isDomainID)

  if (tx.DomainID != null && tx.Holder != null) {
    throw new ValidationError(
      'MPTokenIssuanceSet: Cannot set both DomainID and Holder fields.',
    )
  }

  if (typeof tx.ImmutableFlags === 'number') {
    // eslint-disable-next-line no-bitwise -- Need bitwise operations to replicate rippled behavior
    const invalidBits = tx.ImmutableFlags & tifMPTokenIssuanceImmutableMask
    // rippled rejects a present-but-zero ImmutableFlags, as well as out-of-mask bits.
    if (tx.ImmutableFlags === 0 || invalidBits !== 0) {
      throw new ValidationError(
        'MPTokenIssuanceSet: Invalid ImmutableFlags value',
      )
    }
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Pseudo-Txn missing in BaseTransaction type.
  const flagsNum = convertTxFlagsToNumber(tx as Transaction)
  const isTfMPTLock = isFlagEnabled(flagsNum, MPTokenIssuanceSetFlags.tfMPTLock)
  const isTfMPTUnlock = isFlagEnabled(
    flagsNum,
    MPTokenIssuanceSetFlags.tfMPTUnlock,
  )
  // eslint-disable-next-line no-bitwise -- Need bitwise operations to replicate rippled behavior
  const hasEnableFlag = (flagsNum & tfMPTokenIssuanceSetEnableFlagMask) !== 0

  if (isTfMPTLock && isTfMPTUnlock) {
    throw new ValidationError('MPTokenIssuanceSet: flag conflict')
  }

  if (tx.Holder != null && tx.Holder === tx.Account) {
    throw new ValidationError(
      'MPTokenIssuanceSet: Holder cannot be the same as the Account.',
    )
  }

  // A mutation sets/updates a capability flag, MPTokenMetadata, TransferFee, or
  // ImmutableFlags. These may not be combined with a Holder or a lock/unlock.
  const isMutate =
    hasEnableFlag ||
    tx.MPTokenMetadata != null ||
    tx.TransferFee != null ||
    tx.ImmutableFlags != null
  const isSetConfidentialKeys =
    tx.IssuerEncryptionKey != null || tx.AuditorEncryptionKey != null

  if (
    flagsNum === 0 &&
    tx.DomainID == null &&
    !isMutate &&
    !isSetConfidentialKeys
  ) {
    throw new ValidationError(
      'MPTokenIssuanceSet: Transaction does not change the state of the MPTokenIssuance ledger object.',
    )
  }

  if (isMutate && tx.Holder != null) {
    throw new ValidationError(
      'MPTokenIssuanceSet: Holder field is not allowed when mutating MPTokenIssuance.',
    )
  }

  // Registering issuer/auditor encryption keys is issuance-wide; rippled rejects it
  // paired with a per-holder target (temMALFORMED).
  if (isSetConfidentialKeys && tx.Holder != null) {
    throw new ValidationError(
      'MPTokenIssuanceSet: Holder field is not allowed when registering confidential encryption keys.',
    )
  }

  if (isMutate && (isTfMPTLock || isTfMPTUnlock)) {
    throw new ValidationError(
      'MPTokenIssuanceSet: Can not lock/unlock while mutating MPTokenIssuance.',
    )
  }

  if (typeof tx.TransferFee === 'number') {
    if (tx.TransferFee < 0 || tx.TransferFee > MAX_TRANSFER_FEE) {
      throw new ValidationError(
        `MPTokenIssuanceSet: TransferFee must be between 0 and ${MAX_TRANSFER_FEE}`,
      )
    }
    // Confidential amounts are encrypted, so a transfer rate cannot apply;
    // rippled rejects this pairing with temBAD_TRANSFER_FEE.
    if (
      tx.TransferFee > 0 &&
      isFlagEnabled(
        flagsNum,
        MPTokenIssuanceSetFlags.tfMPTSetCanHoldConfidentialBalance,
      )
    ) {
      throw new ValidationError(
        'MPTokenIssuanceSet: TransferFee cannot be provided together with the tfMPTSetCanHoldConfidentialBalance flag',
      )
    }
  }

  // An empty MPTokenMetadata is valid on MPTokenIssuanceSet: per rippled it
  // clears the existing metadata (makeFieldAbsent). Only validate the hex
  // format, length, and XLS-89 schema when a non-empty value is supplied.
  if (typeof tx.MPTokenMetadata === 'string' && tx.MPTokenMetadata.length > 0) {
    if (
      !isHex(tx.MPTokenMetadata) ||
      tx.MPTokenMetadata.length / 2 > MAX_MPT_META_BYTE_LENGTH
    ) {
      throw new ValidationError(
        `MPTokenIssuanceSet: MPTokenMetadata must be a valid hex string no more than ${MAX_MPT_META_BYTE_LENGTH} bytes (an empty string clears the field).`,
      )
    }

    const validationMessages = validateMPTokenMetadata(tx.MPTokenMetadata)

    if (validationMessages.length > 0) {
      const message = [
        MPT_META_WARNING_HEADER,
        ...validationMessages.map((msg) => `- ${msg}`),
      ].join('\n')

      // eslint-disable-next-line no-console -- Required here.
      console.warn(message)
    }
  }
}
/* eslint-enable max-lines-per-function, max-statements */
