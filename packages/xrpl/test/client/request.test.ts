import { assert } from 'chai'

import responses from '../fixtures/responses'
import rippled from '../fixtures/rippled'
import {
  setupClient,
  teardownClient,
  type XrplTestContext,
} from '../setupClient'
import { addressTests, assertResultMatch } from '../testUtils'

describe('client.request', function () {
  let testContext: XrplTestContext

  beforeEach(async () => {
    testContext = await setupClient()
  })
  afterEach(async () => teardownClient(testContext))

  addressTests.forEach(function (testcase) {
    describe(testcase.type, () => {
      it('request account_objects', async function () {
        testContext.mockRippled!.addResponse(
          'account_objects',
          rippled.account_objects.normal,
        )
        const result = await testContext.client.request({
          command: 'account_objects',
          account: testcase.address,
        })

        assertResultMatch(
          result.result,
          responses.getAccountObjects,
          'AccountObjectsResponse',
        )
      })

      it('request account_objects - invalid options', async function () {
        testContext.mockRippled!.addResponse(
          'account_objects',
          rippled.account_objects.normal,
        )
        const result = await testContext.client.request({
          command: 'account_objects',
          account: testcase.address,
        })

        assertResultMatch(
          result.result,
          responses.getAccountObjects,
          'AccountObjectsResponse',
        )
      })
    })
  })
})

describe('client.request clio methods', function () {
  let testContext: XrplTestContext

  beforeEach(async () => {
    testContext = await setupClient()
  })
  afterEach(async () => teardownClient(testContext))

  it('request mpt_holders', async function () {
    const mptIssuanceId = '05EECEBE97A7D635DE2393068691A015FED5A89AD203F5AA'
    testContext.mockRippled!.addResponse('mpt_holders', {
      status: 'success',
      type: 'response',
      result: {
        mpt_issuance_id: mptIssuanceId,
        mptokens: [
          {
            account: 'rsNw23ygZatXv7h8QVSgAE4jktY2uW1iZP',
            flags: 0,
            mpt_amount: '100',
            mptoken_index:
              '081078D38E9C36647B4AD95ECB476F434B817753AD4F6B4B5EE0ED4C3185C80F',
          },
        ],
        ledger_index: 99563041,
        validated: true,
      },
    })
    const response = await testContext.client.request({
      command: 'mpt_holders',
      mpt_issuance_id: mptIssuanceId,
    })

    assert.equal(response.result.mpt_issuance_id, mptIssuanceId)
    assert.equal(response.result.mptokens.length, 1)
    assert.equal(response.result.mptokens[0].mpt_amount, '100')
  })
})
