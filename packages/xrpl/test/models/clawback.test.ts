import { validateClawback } from '../../src/models/transactions/clawback'
import { assertTxIsValid, assertTxValidationError } from '../testUtils'

const assertValid = (tx: any): void => assertTxIsValid(tx, validateClawback)
const assertInvalid = (tx: any, message: string): void =>
  assertTxValidationError(tx, validateClawback, message)

const ISSUER = 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm'
const HOLDER = 'rfkE1aSy9G8Upk4JssnwBxhEv5p4mn2KTy'
// The trailing 20 bytes of an MPTokenIssuanceID are the issuer's AccountID;
// this one embeds ISSUER.
const MPT_ID = '000004C40596915CFDEEE3A695B3EFD6BDA9AC788A368B7B'
// An issuance whose embedded issuer is a different account.
const NON_ISSUER_MPT_ID = '000004C463C52827307480341125DA0577DEFC38405B0E3E'

/**
 * Clawback Transaction Verification Testing.
 *
 * Providing runtime verification testing for each specific transaction type.
 */
describe('Clawback', function () {
  it(`verifies valid Clawback`, function () {
    const validClawback = {
      TransactionType: 'Clawback',
      Amount: {
        currency: 'DSH',
        issuer: 'rcXY84C4g14iFp6taFXjjQGVeHqSCh9RX',
        value: '43.11584856965009',
      },
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
    } as any

    assertValid(validClawback)
  })

  it(`throws w/ missing Amount`, function () {
    const missingAmount = {
      TransactionType: 'Clawback',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
    } as any

    assertInvalid(missingAmount, 'Clawback: missing field Amount')
  })

  it(`throws w/ invalid Amount`, function () {
    const invalidAmount = {
      TransactionType: 'Clawback',
      Amount: 100000000,
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
    } as any

    assertInvalid(invalidAmount, 'Clawback: invalid field Amount')

    const invalidStrAmount = {
      TransactionType: 'Clawback',
      Amount: '1234',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
    } as any

    assertInvalid(invalidStrAmount, 'Clawback: invalid field Amount')
  })

  it(`throws w/ invalid holder Account`, function () {
    const invalidAccount = {
      TransactionType: 'Clawback',
      Amount: {
        currency: 'DSH',
        issuer: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
        value: '43.11584856965009',
      },
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
    } as any

    assertInvalid(invalidAccount, 'Clawback: invalid holder Account')
  })

  it(`verifies valid MPT Clawback`, function () {
    const validClawback = {
      TransactionType: 'Clawback',
      Amount: {
        mpt_issuance_id: MPT_ID,
        value: '10',
      },
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      Holder: 'rfkE1aSy9G8Upk4JssnwBxhEv5p4mn2KTy',
    } as any

    assertValid(validClawback)
  })

  it(`throws w/ invalid Holder Account`, function () {
    const invalidAccount = {
      TransactionType: 'Clawback',
      Amount: {
        mpt_issuance_id: MPT_ID,
        value: '10',
      },
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      Holder: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
    } as any

    assertInvalid(invalidAccount, 'Clawback: invalid holder Account')
  })

  it(`throws w/ invalid Holder`, function () {
    const invalidAccount = {
      TransactionType: 'Clawback',
      Amount: {
        mpt_issuance_id: MPT_ID,
        value: '10',
      },
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
    } as any

    assertInvalid(invalidAccount, 'Clawback: missing Holder')
  })

  it(`throws w/ invalid currency Holder`, function () {
    const invalidAccount = {
      TransactionType: 'Clawback',
      Amount: {
        currency: 'DSH',
        issuer: 'rfkE1aSy9G8Upk4JssnwBxhEv5p4mn2KTy',
        value: '43.11584856965009',
      },
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      Holder: 'rfkE1aSy9G8Upk4JssnwBxhEv5p4mn2KTy',
    } as any

    assertInvalid(invalidAccount, 'Clawback: cannot have Holder for currency')
  })

  it(`throws when Account is not the issuer of the MPT`, function () {
    assertInvalid(
      {
        TransactionType: 'Clawback',
        Amount: { mpt_issuance_id: NON_ISSUER_MPT_ID, value: '10' },
        Account: ISSUER,
        Holder: HOLDER,
      } as any,
      'Clawback: Account must be the issuer of the MPTokenIssuanceID',
    )
  })

  it(`throws w/ zero MPT Amount`, function () {
    assertInvalid(
      {
        TransactionType: 'Clawback',
        Amount: { mpt_issuance_id: MPT_ID, value: '0' },
        Account: ISSUER,
        Holder: HOLDER,
      } as any,
      'Clawback: Amount value must be greater than zero',
    )
  })

  it(`throws w/ non-canonical MPT Amount value`, function () {
    for (const value of [
      '-1',
      '1.5',
      '1e2',
      '+1',
      '0x10',
      '',
      ' 1',
      '007',
      '9223372036854775808',
      10,
    ]) {
      assertInvalid(
        {
          TransactionType: 'Clawback',
          Amount: { mpt_issuance_id: MPT_ID, value },
          Account: ISSUER,
          Holder: HOLDER,
        } as any,
        'Clawback: invalid field Amount',
      )
    }

    // The maximum MPT amount (2^63 - 1) is valid.
    assertValid({
      TransactionType: 'Clawback',
      Amount: { mpt_issuance_id: MPT_ID, value: '9223372036854775807' },
      Account: ISSUER,
      Holder: HOLDER,
    } as any)
  })

  it(`throws w/ malformed mpt_issuance_id`, function () {
    assertInvalid(
      {
        TransactionType: 'Clawback',
        Amount: { mpt_issuance_id: 'ABCD', value: '10' },
        Account: ISSUER,
        Holder: HOLDER,
      } as any,
      'Clawback: invalid field Amount',
    )
  })

  it(`accepts an MPT Amount carrying an extra undefined-valued key`, function () {
    assertValid({
      TransactionType: 'Clawback',
      Amount: { mpt_issuance_id: MPT_ID, value: '10', issuer: undefined },
      Account: ISSUER,
      Holder: HOLDER,
    } as any)
  })

  it(`throws w/ any transaction-specific flag bit`, function () {
    assertInvalid(
      {
        TransactionType: 'Clawback',
        Amount: { mpt_issuance_id: MPT_ID, value: '10' },
        Account: ISSUER,
        Holder: HOLDER,
        Flags: 0x1,
      } as any,
      'Clawback: invalid Flags',
    )

    // Universal bits are allowed.
    assertValid({
      TransactionType: 'Clawback',
      Amount: { mpt_issuance_id: MPT_ID, value: '10' },
      Account: ISSUER,
      Holder: HOLDER,
      Flags: 0x80000000,
    } as any)
  })
})
