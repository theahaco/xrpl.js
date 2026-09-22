import { assert } from 'chai'
import cloneDeep from 'lodash/cloneDeep'

import type {
  Amount,
  Payment,
  PaymentV2,
  TransactionV2,
  TxResponse,
} from '../../src'
import rippled from '../fixtures/rippled'
import {
  setupClient,
  teardownClient,
  type XrplTestContext,
} from '../setupClient'

const paymentFixture = rippled.tx.Payment
const DELIVER_MAX = paymentFixture.result.tx_json.DeliverMax

/**
 * Returns the amount a transaction asked to deliver, if it is a Payment.
 * Narrowing on `TransactionType` selects {@link PaymentV2}, whose
 * `DeliverMax` is required.
 *
 * @param tx - A transaction in the API v2 read shape.
 * @returns The requested amount, or undefined if the transaction is not a Payment.
 */
function requestedAmount(tx: TransactionV2): Amount | undefined {
  return tx.TransactionType === 'Payment' ? tx.DeliverMax : undefined
}

/**
 * rippled API v2 reports a Payment's requested amount as `DeliverMax` and
 * omits `Amount` on every read path. The types must say the same.
 */
describe('API v2 Payment read shape', function () {
  let testContext: XrplTestContext

  beforeEach(async () => {
    testContext = await setupClient()
  })
  afterEach(async () => teardownClient(testContext))

  it('tx: DeliverMax is required and Amount is absent', async function () {
    testContext.mockRippled!.addResponse('tx', paymentFixture)
    const resp = await testContext.client.request({
      command: 'tx',
      transaction: paymentFixture.result.tx_json.hash,
    })
    const tx = resp.result.tx_json

    if (tx.TransactionType !== 'Payment') {
      assert.fail('fixture is a Payment')
    }
    const deliverMax: Amount = tx.DeliverMax
    assert.deepEqual(deliverMax, DELIVER_MAX)
    // @ts-expect-error -- API v2 never reports Amount; the value is under DeliverMax
    const amount: Payment['Amount'] = tx.Amount
    assert.isUndefined(amount)
  })

  it('account_tx: tx_json is in the read shape', async function () {
    const mockResponse = cloneDeep(rippled.account_tx.normal)
    mockResponse.result.transactions.push({
      tx_json: paymentFixture.result.tx_json,
      meta: paymentFixture.result.meta,
      validated: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- we are mocking the response
    } as any)
    testContext.mockRippled!.addResponse('account_tx', mockResponse)
    const resp = await testContext.client.request({
      command: 'account_tx',
      account: mockResponse.result.account,
    })

    const payment = resp.result.transactions
      .map((entry) => entry.tx_json)
      .find((tx) => tx?.TransactionType === 'Payment')
    assert.isDefined(payment)
    assert.deepEqual(requestedAmount(payment), DELIVER_MAX)
  })

  it('transaction_entry: tx_json is in the read shape', async function () {
    testContext.mockRippled!.addResponse(
      'transaction_entry',
      rippled.transaction_entry,
    )
    const resp = await testContext.client.request({
      command: 'transaction_entry',
      tx_hash: rippled.transaction_entry.result.tx_json.hash,
    })

    assert.strictEqual(
      requestedAmount(resp.result.tx_json),
      rippled.transaction_entry.result.tx_json.DeliverMax,
    )
  })

  it('TxResponse<Payment> (what submitAndWait resolves to) is a PaymentV2', function () {
    function readBack(response: TxResponse<Payment>): Amount {
      const payment: PaymentV2 = response.result.tx_json
      // @ts-expect-error -- API v2 never reports Amount; the value is under DeliverMax
      const amount: Payment['Amount'] = payment.Amount
      assert.isUndefined(amount)
      return payment.DeliverMax
    }

    const response = paymentFixture as unknown as TxResponse<Payment>
    assert.deepEqual(readBack(response), DELIVER_MAX)
  })
})
