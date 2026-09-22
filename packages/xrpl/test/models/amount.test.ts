import { assert } from 'chai'

import type { Amount, IssuedCurrencyAmount, MPTAmount } from '../../src'
import {
  isAmount,
  isTokenAmount,
  parseAmountValue,
} from '../../src/models/transactions/common'

const MPT_ISSUANCE_ID = '000004C463C52827307480341125DA0577DEFC38405B0E3E'

/**
 * `Amount` is the SDK's "any amount" type. It must admit every amount the
 * ledger can express, and the `isAmount` guard must narrow to the same set.
 */
describe('Amount', function () {
  const xrp: Amount = '1000000'
  const iou: IssuedCurrencyAmount = {
    currency: 'USD',
    issuer: 'rPzwM2JfCSDjhbesdTCqFjWWdK7eFtTwZz',
    value: '1.5',
  }
  const mpt: MPTAmount = { mpt_issuance_id: MPT_ISSUANCE_ID, value: '10' }

  it('admits XRP drops, issued currency amounts and MPT amounts', function () {
    // The MPT entry is the point of this test: it does not compile when
    // `Amount` excludes `MPTAmount`.
    const amounts: Amount[] = [xrp, iou, mpt]

    assert.isTrue(amounts.every((amount) => isAmount(amount)))
  })

  it('isAmount narrows to a type that covers the MPT case', function () {
    const value: unknown = mpt

    if (!isAmount(value)) {
      assert.fail('an MPT amount is an Amount')
    }
    // An Amount that is neither XRP nor an issued currency is an MPT amount;
    // this branch only type-checks when `Amount` includes `MPTAmount`.
    if (typeof value !== 'string' && !('currency' in value)) {
      assert.strictEqual(value.mpt_issuance_id, MPT_ISSUANCE_ID)
    } else {
      assert.fail('expected the MPT branch')
    }
    assert.isTrue(isTokenAmount(value))
  })

  it('parseAmountValue reads every Amount variant', function () {
    assert.strictEqual(parseAmountValue(xrp), 1000000)
    assert.strictEqual(parseAmountValue(iou), 1.5)
    assert.strictEqual(parseAmountValue(mpt), 10)
  })
})
