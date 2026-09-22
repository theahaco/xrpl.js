import { ValidationError } from '../../errors'

import {
  Account,
  BaseTransaction,
  isAccount,
  validateBaseTransaction,
  validateCredentialType,
  validateOptionalField,
} from './common'

/**
 * Deletes a Credential object.
 *
 * @category Transaction Models
 * */
export interface CredentialDelete extends BaseTransaction {
  TransactionType: 'CredentialDelete'

  /** The transaction submitter. */
  Account: Account

  /** A hex-encoded value to identify the type of credential from the issuer. */
  CredentialType: string

  /** The person that the credential is for. If omitted, Account is assumed to be the subject. */
  Subject?: Account

  /** The issuer of the credential. If omitted, Account is assumed to be the issuer. */
  Issuer?: Account
}

/**
 * Verify the form and type of a CredentialDelete at runtime.
 *
 * @param tx - A CredentialDelete Transaction.
 * @throws When the CredentialDelete is Malformed.
 */
export function validateCredentialDelete(tx: Record<string, unknown>): void {
  validateBaseTransaction(tx)

  if (!tx.Subject && !tx.Issuer) {
    throw new ValidationError(
      'CredentialDelete: either `Issuer` or `Subject` must be provided',
    )
  }

  validateCredentialType(tx)

  validateOptionalField(tx, 'Subject', isAccount)

  validateOptionalField(tx, 'Issuer', isAccount)
}
