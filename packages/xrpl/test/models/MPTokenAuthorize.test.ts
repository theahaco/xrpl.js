import { MPTokenAuthorizeFlags } from '../../src'
import { validateMPTokenAuthorize } from '../../src/models/transactions/MPTokenAuthorize'
import { assertTxIsValid, assertTxValidationError } from '../testUtils'

const assertValid = (tx: any): void =>
  assertTxIsValid(tx, validateMPTokenAuthorize)
const assertInvalid = (tx: any, message: string): void =>
  assertTxValidationError(tx, validateMPTokenAuthorize, message)

const ISSUER = 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm'
const HOLDER = 'rajgkBmMxmz161r8bWYH7CQAFZP5bA9oSG'
// The trailing 20 bytes of an MPTokenIssuanceID are the issuer's AccountID;
// this one embeds ISSUER.
const TOKEN_ID = '000004C40596915CFDEEE3A695B3EFD6BDA9AC788A368B7B'

/**
 * MPTokenAuthorize Transaction Verification Testing.
 *
 * Providing runtime verification testing for each specific transaction type.
 */
describe('MPTokenAuthorize', function () {
  it(`verifies valid MPTokenAuthorize`, function () {
    // A holder opting in to an issuance.
    let validMPTokenAuthorize = {
      TransactionType: 'MPTokenAuthorize',
      Account: HOLDER,
      MPTokenIssuanceID: TOKEN_ID,
    } as any

    assertValid(validMPTokenAuthorize)

    // The issuer authorizing a holder.
    validMPTokenAuthorize = {
      TransactionType: 'MPTokenAuthorize',
      Account: ISSUER,
      Holder: HOLDER,
      MPTokenIssuanceID: TOKEN_ID,
    } as any

    assertValid(validMPTokenAuthorize)

    // A holder deleting their (empty) MPToken.
    validMPTokenAuthorize = {
      TransactionType: 'MPTokenAuthorize',
      Account: HOLDER,
      MPTokenIssuanceID: TOKEN_ID,
      Flags: MPTokenAuthorizeFlags.tfMPTUnauthorize,
    } as any

    assertValid(validMPTokenAuthorize)

    // The issuer unauthorizing a holder.
    validMPTokenAuthorize = {
      TransactionType: 'MPTokenAuthorize',
      Account: ISSUER,
      MPTokenIssuanceID: TOKEN_ID,
      Holder: HOLDER,
      Flags: { tfMPTUnauthorize: true },
    } as any

    assertValid(validMPTokenAuthorize)

    // The universal tfFullyCanonicalSig / tfInnerBatchTxn bits are allowed.
    validMPTokenAuthorize = {
      TransactionType: 'MPTokenAuthorize',
      Account: HOLDER,
      MPTokenIssuanceID: TOKEN_ID,
      // tfFullyCanonicalSig + tfInnerBatchTxn, added (not OR-ed) to keep the
      // number positive.
      Flags: 0x80000000 + 0x40000000 + MPTokenAuthorizeFlags.tfMPTUnauthorize,
    } as any

    assertValid(validMPTokenAuthorize)
  })

  it(`throws w/ missing MPTokenIssuanceID`, function () {
    const invalid = {
      TransactionType: 'MPTokenAuthorize',
      Account: HOLDER,
    } as any

    assertInvalid(invalid, 'MPTokenAuthorize: missing field MPTokenIssuanceID')
  })

  it(`throws w/ malformed MPTokenIssuanceID`, function () {
    for (const bad of [
      'ABCD',
      TOKEN_ID.slice(1),
      `${TOKEN_ID}0`,
      'XY'.repeat(24),
      12,
    ]) {
      assertInvalid(
        {
          TransactionType: 'MPTokenAuthorize',
          Account: HOLDER,
          MPTokenIssuanceID: bad,
        } as any,
        'MPTokenAuthorize: invalid field MPTokenIssuanceID',
      )
    }
  })

  it(`throws w/ Holder equal to Account`, function () {
    const invalid = {
      TransactionType: 'MPTokenAuthorize',
      Account: ISSUER,
      Holder: ISSUER,
      MPTokenIssuanceID: TOKEN_ID,
    } as any

    assertInvalid(
      invalid,
      'MPTokenAuthorize: Holder cannot be the same as the Account.',
    )
  })

  it(`throws w/ flag bits outside tfMPTokenAuthorizeMask`, function () {
    for (const flags of [0x2, 0x8000, 0x3, 1.5, -1, 2 ** 32]) {
      assertInvalid(
        {
          TransactionType: 'MPTokenAuthorize',
          Account: HOLDER,
          MPTokenIssuanceID: TOKEN_ID,
          Flags: flags,
        } as any,
        'MPTokenAuthorize: invalid Flags',
      )
    }
  })

  it(`throws when the issuer omits Holder`, function () {
    assertInvalid(
      {
        TransactionType: 'MPTokenAuthorize',
        Account: ISSUER,
        MPTokenIssuanceID: TOKEN_ID,
      } as any,
      'MPTokenAuthorize: the issuer of the MPTokenIssuanceID must specify Holder',
    )
  })

  it(`throws when a non-issuer supplies Holder`, function () {
    assertInvalid(
      {
        TransactionType: 'MPTokenAuthorize',
        Account: HOLDER,
        Holder: 'rfkE1aSy9G8Upk4JssnwBxhEv5p4mn2KTy',
        MPTokenIssuanceID: TOKEN_ID,
      } as any,
      'MPTokenAuthorize: only the issuer of the MPTokenIssuanceID may specify Holder',
    )
  })
})
