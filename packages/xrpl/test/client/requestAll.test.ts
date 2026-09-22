import { assert } from 'chai'
import cloneDeep from 'lodash/cloneDeep'

import type { Request } from '../../src'
import addresses from '../fixtures/addresses.json'
import rippled from '../fixtures/rippled'
import {
  setupClient,
  teardownClient,
  type XrplTestContext,
} from '../setupClient'

const rippledResponse = function (request: Request): Record<string, unknown> {
  if ('marker' in request) {
    return rippled.ledger_data.lastPage
  }
  return rippled.ledger_data.firstPage
}

const rippledResponseFirstEmpty = function (
  request: Request,
): Record<string, unknown> {
  if ('marker' in request) {
    return rippled.ledger_data.lastPage
  }
  return rippled.ledger_data.firstPageEmpty
}

describe('client.requestAll', function () {
  let testContext: XrplTestContext

  beforeEach(async () => {
    testContext = await setupClient()
  })
  afterEach(async () => teardownClient(testContext))
  it('requests the next page', async function () {
    testContext.mockRippled!.addResponse('ledger_data', rippledResponse)
    const allResponses = await testContext.client.requestAll({
      command: 'ledger_data',
    })
    assert.equal(allResponses.length, 2)
    assert.equal(
      allResponses[1].result.state[0].index,
      '000B714B790C3C79FEE00D17C4DEB436B375466F29679447BA64F265FD63D731',
    )
  })

  it('stops when there are no more pages', async function () {
    testContext.mockRippled!.addResponse(
      'ledger_data',
      rippled.ledger_data.lastPage,
    )
    const allResponses = await testContext.client.requestAll({
      command: 'ledger_data',
    })
    assert.equal(allResponses.length, 1)
  })

  it('handles when the first page has no results', async function () {
    testContext.mockRippled!.addResponse(
      'ledger_data',
      rippledResponseFirstEmpty,
    )
    const allResponses = await testContext.client.requestAll({
      command: 'ledger_data',
    })
    assert.equal(allResponses.length, 2)
  })
})

describe('client.requestAll parity with client.request', function () {
  let testContext: XrplTestContext

  beforeEach(async () => {
    testContext = await setupClient()
  })
  afterEach(async () => teardownClient(testContext))

  it('adds partial payment warnings to every page', async function () {
    const partial = {
      ...rippled.tx.Payment,
      result: rippled.partial_payments.iou,
    }
    const firstPage = cloneDeep(rippled.account_tx.normal)
    firstPage.result.transactions.push({
      tx_json: partial.result.tx_json,
      meta: partial.result.meta,
      validated: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- we are mocking the response
    } as any)
    const lastPage: Record<string, unknown> = {
      ...rippled.account_tx.normal,
      result: { ...rippled.account_tx.normal.result, marker: undefined },
    }

    testContext.mockRippled!.addResponse('account_tx', (request: Request) => {
      return 'marker' in request ? lastPage : firstPage
    })
    const allResponses = await testContext.client.requestAll({
      command: 'account_tx',
      account: firstPage.result.account,
    })

    assert.equal(allResponses.length, 2)
    assert.deepEqual(allResponses[0].warnings, [
      {
        id: 2001,
        message: 'This response contains a Partial Payment',
      },
    ])
    assert.equal(allResponses[1].warnings, undefined)
  })

  it('converts an X-address account to a classic address', async function () {
    const seen: unknown[] = []
    testContext.mockRippled!.addResponse('account_tx', (request: Request) => {
      seen.push(request.account)
      return {
        ...rippled.account_tx.normal,
        result: { ...rippled.account_tx.normal.result, marker: undefined },
      }
    })
    await testContext.client.requestAll({
      command: 'account_tx',
      account: addresses.ACCOUNT_X,
    })

    assert.deepEqual(seen, [addresses.ACCOUNT])
  })

  it('pages through the Clio-only mpt_holders method', async function () {
    const holder = {
      account: addresses.ACCOUNT,
      flags: 0,
      mpt_amount: '100',
      mptoken_index:
        '081078D38E9C36647B4AD95ECB476F434B817753AD4F6B4B5EE0ED4C3185C80F',
    }
    const page = (marker?: string): Record<string, unknown> => ({
      status: 'success',
      type: 'response',
      result: {
        mpt_issuance_id: '05EECEBE97A7D635DE2393068691A015FED5A89AD203F5AA',
        mptokens: [holder],
        ledger_index: 99563041,
        validated: true,
        ...(marker == null ? {} : { marker }),
      },
    })
    testContext.mockRippled!.addResponse('mpt_holders', (request: Request) => {
      return 'marker' in request ? page() : page('next')
    })

    const allResponses = await testContext.client.requestAll({
      command: 'mpt_holders',
      mpt_issuance_id: '05EECEBE97A7D635DE2393068691A015FED5A89AD203F5AA',
    })

    assert.equal(allResponses.length, 2)
    assert.equal(allResponses[1].result.mptokens[0].account, addresses.ACCOUNT)
  })
})
