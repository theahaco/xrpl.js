import { validateMPTokenIssuanceDestroy } from '../../src/models/transactions/MPTokenIssuanceDestroy'
import { assertTxIsValid, assertTxValidationError } from '../testUtils'

const assertValid = (tx: any): void =>
  assertTxIsValid(tx, validateMPTokenIssuanceDestroy)
const assertInvalid = (tx: any, message: string): void =>
  assertTxValidationError(tx, validateMPTokenIssuanceDestroy, message)

const ISSUER = 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm'
// The trailing 20 bytes of an MPTokenIssuanceID are the issuer's AccountID;
// this one embeds ISSUER.
const TOKEN_ID = '000004C40596915CFDEEE3A695B3EFD6BDA9AC788A368B7B'
// An issuance whose embedded issuer is a different account.
const NON_ISSUER_TOKEN_ID = '000004C463C52827307480341125DA0577DEFC38405B0E3E'

/**
 * MPTokenIssuanceDestroy Transaction Verification Testing.
 *
 * Providing runtime verification testing for each specific transaction type.
 */
describe('MPTokenIssuanceDestroy', function () {
  it(`verifies valid MPTokenIssuanceDestroy`, function () {
    const validMPTokenIssuanceDestroy = {
      TransactionType: 'MPTokenIssuanceDestroy',
      Account: ISSUER,
      MPTokenIssuanceID: TOKEN_ID,
    } as any

    assertValid(validMPTokenIssuanceDestroy)

    // Universal flag bits are allowed.
    assertValid({
      TransactionType: 'MPTokenIssuanceDestroy',
      Account: ISSUER,
      MPTokenIssuanceID: TOKEN_ID,
      Flags: 0x80000000,
    } as any)
  })

  it(`throws w/ missing MPTokenIssuanceID`, function () {
    const invalid = {
      TransactionType: 'MPTokenIssuanceDestroy',
      Account: ISSUER,
    } as any

    assertInvalid(
      invalid,
      'MPTokenIssuanceDestroy: missing field MPTokenIssuanceID',
    )
  })

  it(`throws w/ malformed MPTokenIssuanceID`, function () {
    assertInvalid(
      {
        TransactionType: 'MPTokenIssuanceDestroy',
        Account: ISSUER,
        MPTokenIssuanceID: 'ABCD',
      } as any,
      'MPTokenIssuanceDestroy: invalid field MPTokenIssuanceID',
    )
  })

  it(`throws when Account is not the issuer`, function () {
    assertInvalid(
      {
        TransactionType: 'MPTokenIssuanceDestroy',
        Account: ISSUER,
        MPTokenIssuanceID: NON_ISSUER_TOKEN_ID,
      } as any,
      'MPTokenIssuanceDestroy: Account must be the issuer of the MPTokenIssuanceID',
    )
  })

  it(`throws w/ any transaction-specific flag bit`, function () {
    assertInvalid(
      {
        TransactionType: 'MPTokenIssuanceDestroy',
        Account: ISSUER,
        MPTokenIssuanceID: TOKEN_ID,
        Flags: 0x1,
      } as any,
      'MPTokenIssuanceDestroy: invalid Flags',
    )
  })
})
