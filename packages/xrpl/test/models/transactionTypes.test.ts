import { assert } from 'chai'

import {
  LenientTransaction,
  MPTokenIssuanceSet,
  MPTokenIssuanceSetFlags,
  Payment,
  validate,
} from '../../src'

/**
 * Compile-time checks for the transaction models.
 *
 * ts-jest type-checks this file, so a regression here fails the suite before
 * any test runs. The `assert` calls only give jest something to execute; the
 * `@ts-expect-error` directives are the real assertions: each one fails to
 * compile ("Unused '@ts-expect-error' directive") as soon as the line below
 * it stops being a type error.
 */

// `true` iff X and Y are the same type.
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
    ? true
    : false

const ACCOUNT = 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm'
const HOLDER = 'rajgkBmMxmz161r8bWYH7CQAFZP5bA9oSG'
const TOKEN_ID = '000004C463C52827307480341125DA0577DEFC38405B0E3E'

describe('transaction models are strict', function () {
  it('keyof is the literal field union, not string | number', function () {
    const keyofIsNotString: Equal<
      string extends keyof MPTokenIssuanceSet ? true : false,
      false
    > = true
    const holderIsAKey: 'Holder' extends keyof MPTokenIssuanceSet
      ? true
      : false = true
    // @ts-expect-error -- 'not-a-field' is not a key of MPTokenIssuanceSet
    const notAKey: keyof MPTokenIssuanceSet = 'not-a-field'

    assert.deepEqual([keyofIsNotString, holderIsAKey], [true, true])
    assert.equal(notAKey, 'not-a-field')
  })

  it('rejects unknown field names on a transaction literal', function () {
    const typo: MPTokenIssuanceSet = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: ACCOUNT,
      MPTokenIssuanceID: TOKEN_ID,
      // @ts-expect-error -- 'Hodler' is a typo of 'Holder'; excess-property check must catch it
      Hodler: HOLDER,
    }
    const partialTypo: Partial<Payment> = {
      // @ts-expect-error -- 'Destinaton' is a typo of 'Destination'
      Destinaton: HOLDER,
    }

    assert.equal(typo.TransactionType, 'MPTokenIssuanceSet')
    assert.isUndefined(partialTypo.Destination)
  })

  it('Omit removes the key and keeps the other fields required', function () {
    const omitted: Omit<MPTokenIssuanceSet, 'Holder'> = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: ACCOUNT,
      MPTokenIssuanceID: TOKEN_ID,
      // @ts-expect-error -- Holder was omitted
      Holder: HOLDER,
    }
    // @ts-expect-error -- Account and TransactionType are still required
    const missingRequired: Omit<MPTokenIssuanceSet, 'MPTokenIssuanceID'> = {}

    assert.equal(omitted.MPTokenIssuanceID, TOKEN_ID)
    assert.isObject(missingRequired)
  })

  it('LenientTransaction keeps the escape hatch for unmodelled fields', function () {
    const lenient: LenientTransaction = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: ACCOUNT,
      MPTokenIssuanceID: TOKEN_ID,
      FieldFromAFutureAmendment: 1,
    }

    assert.equal(lenient.FieldFromAFutureAmendment, 1)
  })

  it('validate() accepts a typed transaction without a cast', function () {
    const tx: MPTokenIssuanceSet = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: ACCOUNT,
      MPTokenIssuanceID: TOKEN_ID,
      Holder: HOLDER,
      Flags: MPTokenIssuanceSetFlags.tfMPTLock,
    }

    assert.doesNotThrow(() => validate(tx))
  })
})
