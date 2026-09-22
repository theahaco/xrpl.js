import { AuthorizeCredential } from '../common'

import {
  BaseTransaction,
  isDomainID,
  validateBaseTransaction,
  validateOptionalField,
  validateRequiredField,
  validateCredentialsList,
  isArray,
} from './common'

const MAX_ACCEPTED_CREDENTIALS = 10

export interface PermissionedDomainSet extends BaseTransaction {
  /* The transaction type (PermissionedDomainSet). */
  TransactionType: 'PermissionedDomainSet'

  /* The domain to modify. Must be included if modifying an existing domain. */
  DomainID?: string

  /* The credentials that are accepted by the domain. Ownership of one
  of these credentials automatically makes you a member of the domain.
  Must contain 1 to 10 entries; to remove a domain use PermissionedDomainDelete. */
  AcceptedCredentials: AuthorizeCredential[]
}

/**
 * Validate a PermissionedDomainSet transaction.
 *
 * @param tx - The transaction to validate.
 * @throws {ValidationError} When the transaction is invalid.
 */
export function validatePermissionedDomainSet(
  tx: Record<string, unknown>,
): void {
  validateBaseTransaction(tx)

  validateOptionalField(tx, 'DomainID', isDomainID)
  validateRequiredField(tx, 'AcceptedCredentials', isArray)

  validateCredentialsList(
    tx.AcceptedCredentials,
    tx.TransactionType,
    // PermissionedDomainSet uses AuthorizeCredential nested objects only, strings are not allowed
    false,
    // PermissionedDomainSet uses at most 10 accepted credentials. This is different from Credential-feature transactions.
    MAX_ACCEPTED_CREDENTIALS,
  )
}
