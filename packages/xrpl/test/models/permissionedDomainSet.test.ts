import { stringToHex } from '@xrplf/isomorphic/utils'

import { AuthorizeCredential } from '../../src'
import { validatePermissionedDomainSet } from '../../src/models/transactions/permissionedDomainSet'
import { assertTxIsValid, assertTxValidationError } from '../testUtils'

const assertValid = (tx: any): void =>
  assertTxIsValid(tx, validatePermissionedDomainSet)
const assertInvalid = (tx: any, message: string): void =>
  assertTxValidationError(tx, validatePermissionedDomainSet, message)

/**
 * PermissionedDomainSet Transaction Verification Testing.
 *
 * Providing runtime verification testing for each specific transaction type.
 */
describe('PermissionedDomainSet', function () {
  let tx: any
  const sampleCredential: AuthorizeCredential = {
    Credential: {
      CredentialType: stringToHex('Passport'),
      Issuer: 'rfmDuhDyLGgx94qiwf3YF8BUV5j6KSvE8',
    },
  }

  beforeEach(function () {
    tx = {
      TransactionType: 'PermissionedDomainSet',
      Account: 'rfmDuhDyLGgx94qiwf3YF8BUV5j6KSvE8',
      DomainID:
        'D88930B33C2B6831660BFD006D91FF100011AD4E67CBB78B460AF0A215103737',
      AcceptedCredentials: [sampleCredential],
    }
  })

  it('verifies valid PermissionedDomainSet', function () {
    assertValid(tx)
  })

  it(`throws with invalid field DomainID`, function () {
    // DomainID is expected to be a string
    tx.DomainID = 1234
    const errorMessage = 'PermissionedDomainSet: invalid field DomainID'
    assertInvalid(tx, errorMessage)
  })

  it(`throws w/ missing field AcceptedCredentials`, function () {
    delete tx.AcceptedCredentials
    const errorMessage =
      'PermissionedDomainSet: missing field AcceptedCredentials'
    assertInvalid(tx, errorMessage)
  })

  it('throws when AcceptedCredentials exceeds maximum length', function () {
    tx.AcceptedCredentials = Array(11).fill(sampleCredential)

    assertInvalid(
      tx,
      'PermissionedDomainSet: Credentials length cannot exceed 10 elements',
    )
  })

  it('throws when AcceptedCredentials is empty', function () {
    tx.AcceptedCredentials = []
    assertInvalid(
      tx,
      'PermissionedDomainSet: Credentials cannot be an empty array',
    )
  })

  it('throws when AcceptedCredentials is not an array type', function () {
    tx.AcceptedCredentials = 'AcceptedCredentials is not an array'
    assertInvalid(
      tx,
      'PermissionedDomainSet: invalid field AcceptedCredentials',
    )
  })

  it('throws when AcceptedCredentials contains duplicates', function () {
    tx.AcceptedCredentials = [sampleCredential, sampleCredential]
    assertInvalid(
      tx,
      'PermissionedDomainSet: Credentials cannot contain duplicate elements',
    )
  })

  it('throws when AcceptedCredentials contains invalid format', function () {
    tx.AcceptedCredentials = [{ Field1: 'Value1', Field2: 'Value2' }]
    assertInvalid(tx, 'PermissionedDomainSet: Invalid Credentials format')
  })

  it(`throws with zero DomainID`, function () {
    tx.DomainID = '0'.repeat(64)
    assertInvalid(tx, 'PermissionedDomainSet: invalid field DomainID')
  })

  it(`throws with short DomainID`, function () {
    tx.DomainID = 'abc'
    assertInvalid(tx, 'PermissionedDomainSet: invalid field DomainID')
  })

  it('throws when AcceptedCredentials contains case-variant duplicates', function () {
    tx.AcceptedCredentials = [
      {
        Credential: {
          CredentialType: 'AB',
          Issuer: sampleCredential.Credential.Issuer,
        },
      },
      {
        Credential: {
          CredentialType: 'ab',
          Issuer: sampleCredential.Credential.Issuer,
        },
      },
    ]
    assertInvalid(
      tx,
      'PermissionedDomainSet: Credentials cannot contain duplicate elements',
    )
  })

  it('throws when AcceptedCredentials contains X-address duplicates', function () {
    tx.AcceptedCredentials = [
      {
        Credential: {
          CredentialType: 'AB',
          Issuer: 'rfmDuhDyLGgx94qiwf3YF8BUV5j6KSvE8',
        },
      },
      {
        Credential: {
          CredentialType: 'AB',
          Issuer: 'X7TviWU5CBaTMzaWiPKt1KE3qKFdzANQk8JNXYAjL8fVZsP',
        },
      },
    ]
    assertInvalid(
      tx,
      'PermissionedDomainSet: Credentials cannot contain duplicate elements',
    )
  })

  it('throws when a credential Issuer is not an address', function () {
    tx.AcceptedCredentials = [
      { Credential: { CredentialType: 'AB', Issuer: 'nope' } },
    ]
    assertInvalid(tx, 'PermissionedDomainSet: Invalid Credentials format')
  })

  it('throws when a credential CredentialType is not hex', function () {
    tx.AcceptedCredentials = [
      {
        Credential: {
          CredentialType: 'zz',
          Issuer: sampleCredential.Credential.Issuer,
        },
      },
    ]
    assertInvalid(tx, 'PermissionedDomainSet: Invalid Credentials format')
  })

  it('throws when a credential CredentialType is empty', function () {
    tx.AcceptedCredentials = [
      {
        Credential: {
          CredentialType: '',
          Issuer: sampleCredential.Credential.Issuer,
        },
      },
    ]
    assertInvalid(tx, 'PermissionedDomainSet: Invalid Credentials format')
  })

  it('throws when a credential CredentialType exceeds 64 bytes', function () {
    tx.AcceptedCredentials = [
      {
        Credential: {
          CredentialType: 'AB'.repeat(65),
          Issuer: sampleCredential.Credential.Issuer,
        },
      },
    ]
    assertInvalid(tx, 'PermissionedDomainSet: Invalid Credentials format')
  })
})
