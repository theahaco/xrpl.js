import { assert } from 'chai'

import { tx, validate } from '../../src'
import type { MPTokenIssuanceCreate, Payment, TransactionOf } from '../../src'

describe('tx', function () {
  it('returns the literal unchanged', function () {
    const fields = {
      TransactionType: 'Payment',
      Account: 'rLnZAb1b9e1w9BfmuPUqyWjhWtWTbMEVUu',
      Destination: 'rD72zF1wfr5irhyaMF9kyET7bxRgsvpLB',
      Amount: '1000',
    } as const

    assert.deepEqual(tx({ ...fields }), { ...fields })
  })

  it('keeps TransactionType narrow through an intermediate binding', function () {
    // The same literal bound to a plain `const` widens its TransactionType to
    // `string`, so the assignment below is what would not compile without the
    // factory — the usual workaround being an `as Payment` assertion.
    const payment = tx({
      TransactionType: 'Payment',
      Account: 'rLnZAb1b9e1w9BfmuPUqyWjhWtWTbMEVUu',
      Destination: 'rD72zF1wfr5irhyaMF9kyET7bxRgsvpLB',
      Amount: { mpt_issuance_id: 'AB'.repeat(24), value: '10' },
    })
    const stillAPayment: Payment = payment

    assert.equal(stillAPayment.TransactionType, 'Payment')
    validate({ ...payment })
  })

  it('types the fields of the selected transaction', function () {
    const create = tx({
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rLnZAb1b9e1w9BfmuPUqyWjhWtWTbMEVUu',
      AssetScale: 2,
      TransferFee: 1000,
    })

    // `AssetScale` only exists on MPTokenIssuanceCreate, so this only compiles
    // because `create` is that type rather than the whole Transaction union.
    assert.equal(create.AssetScale, 2)
  })

  it('TransactionOf selects the model for a TransactionType', function () {
    const create: TransactionOf<'MPTokenIssuanceCreate'> = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rLnZAb1b9e1w9BfmuPUqyWjhWtWTbMEVUu',
    }
    const alsoCreate: MPTokenIssuanceCreate = create

    assert.equal(alsoCreate.TransactionType, 'MPTokenIssuanceCreate')
  })
})
