import { TRANSACTION_TYPES } from 'ripple-binary-codec'

import { ValidationError } from '../../errors'

import {
  BaseTransaction,
  validateBaseTransaction,
  validateRequiredField,
  isAccount,
  isString,
  areAddressesEqual,
  Account,
} from './common'

import type { Transaction } from '.'

const PERMISSIONS_MAX_LENGTH = 10
const NON_DELEGABLE_TRANSACTIONS = new Set([
  'AccountSet',
  'SetRegularKey',
  'SignerListSet',
  'DelegateSet',
  'AccountDelete',
  'Batch',
  // Pseudo transactions below:
  'EnableAmendment',
  'SetFee',
  'UNLModify',
])

/**
 * Granular permissions that can be delegated with a DelegateSet transaction
 * (XLS-75). Each grants a subset of one transaction type rather than the
 * whole type. The names match the `PermissionValue` encoding in
 * ripple-binary-codec.
 *
 * @category Transaction Models
 */
export enum GranularPermission {
  /** Authorize a trust line (TrustSet with tfSetfAuth). */
  TrustlineAuthorize = 'TrustlineAuthorize',
  /** Freeze a trust line (TrustSet with tfSetFreeze). */
  TrustlineFreeze = 'TrustlineFreeze',
  /** Unfreeze a trust line (TrustSet with tfClearFreeze). */
  TrustlineUnfreeze = 'TrustlineUnfreeze',
  /** Set the Domain field (AccountSet). */
  AccountDomainSet = 'AccountDomainSet',
  /** Set the EmailHash field (AccountSet). */
  AccountEmailHashSet = 'AccountEmailHashSet',
  /** Set the MessageKey field (AccountSet). */
  AccountMessageKeySet = 'AccountMessageKeySet',
  /** Set the TransferRate field (AccountSet). */
  AccountTransferRateSet = 'AccountTransferRateSet',
  /** Set the TickSize field (AccountSet). */
  AccountTickSizeSet = 'AccountTickSizeSet',
  /** Send a Payment that mints the issuer's own token. */
  PaymentMint = 'PaymentMint',
  /** Send a Payment that burns the issuer's own token. */
  PaymentBurn = 'PaymentBurn',
  /** Lock an MPT issuance or a single holder (MPTokenIssuanceSet with tfMPTLock). */
  MPTokenIssuanceLock = 'MPTokenIssuanceLock',
  /** Unlock an MPT issuance or a single holder (MPTokenIssuanceSet with tfMPTUnlock). */
  MPTokenIssuanceUnlock = 'MPTokenIssuanceUnlock',
}

/**
 * A value accepted in `Permission.PermissionValue`: a delegatable transaction
 * type name or a {@link GranularPermission}.
 */
export type PermissionValue =
  | Transaction['TransactionType']
  | `${GranularPermission}`

const GRANULAR_PERMISSIONS: Set<string> = new Set(
  Object.values(GranularPermission),
)

export interface Permission {
  Permission: {
    PermissionValue: PermissionValue
  }
}

/**
 * DelegateSet allows an account to delegate a set of permissions to another account.
 *
 * @category Transaction Models
 */
export interface DelegateSet extends BaseTransaction {
  TransactionType: 'DelegateSet'

  /**
   * The authorized account.
   */
  Authorize: Account

  /**
   * The permissions granted to the authorized account: transaction type
   * names or {@link GranularPermission} values. An empty array revokes all
   * permissions.
   */
  Permissions: Permission[]
}

/**
 * Verify the form and type of an DelegateSet at runtime.
 *
 * @param tx - An DelegateSet Transaction.
 * @throws When the DelegateSet is malformed.
 */
// eslint-disable-next-line max-lines-per-function -- necessary for validation
export function validateDelegateSet(tx: Record<string, unknown>): void {
  validateBaseTransaction(tx)

  validateRequiredField(tx, 'Authorize', isAccount)

  if (
    isString(tx.Authorize) &&
    isString(tx.Account) &&
    areAddressesEqual(tx.Authorize, tx.Account)
  ) {
    throw new ValidationError(
      'DelegateSet: Authorize and Account must be different.',
    )
  }

  validateRequiredField(tx, 'Permissions', Array.isArray)

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- required for validation
  const permissions = tx.Permissions as DelegateSet['Permissions']
  if (permissions.length > PERMISSIONS_MAX_LENGTH) {
    throw new ValidationError(
      `DelegateSet: Permissions array length cannot be greater than ${PERMISSIONS_MAX_LENGTH}.`,
    )
  }

  const permissionValueSet = new Set()
  permissions.forEach((permission: Permission) => {
    if (
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- required for validation
      permission == null ||
      Object.keys(permission).length !== 1 ||
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- required for validation
      permission.Permission == null ||
      Object.keys(permission.Permission).length !== 1
    ) {
      throw new ValidationError(
        'DelegateSet: Permissions array element is malformed',
      )
    }
    const permissionValue = permission.Permission.PermissionValue
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- required for validation
    if (permissionValue == null) {
      throw new ValidationError('DelegateSet: PermissionValue must be defined')
    }
    if (typeof permissionValue !== 'string') {
      throw new ValidationError('DelegateSet: PermissionValue must be a string')
    }
    if (NON_DELEGABLE_TRANSACTIONS.has(permissionValue)) {
      throw new ValidationError(
        `DelegateSet: PermissionValue contains a non-delegatable transaction ${permissionValue}`,
      )
    }
    if (
      !GRANULAR_PERMISSIONS.has(permissionValue) &&
      !TRANSACTION_TYPES.includes(permissionValue)
    ) {
      throw new ValidationError(
        `DelegateSet: PermissionValue ${permissionValue} is not a transaction type or granular permission`,
      )
    }
    permissionValueSet.add(permissionValue)
  })
  if (permissions.length !== permissionValueSet.size) {
    throw new ValidationError(
      'DelegateSet: Permissions array cannot contain duplicate values',
    )
  }
}
