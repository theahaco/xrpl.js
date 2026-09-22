import { assert } from 'chai'

import type { Client } from '../../src'
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

  it('request ledger_accept (admin, stand-alone mode)', async function () {
    testContext.mockRippled!.addResponse('ledger_accept', {
      id: 0,
      status: 'success',
      type: 'response',
      result: { ledger_current_index: 5 },
    })
    const response = await testContext.client.request({
      command: 'ledger_accept',
    })

    // `ledger_accept` is a typed request: its result is typed, not `unknown`.
    const index: number = response.result.ledger_current_index
    assert.strictEqual(index, 5)
  })

  it('request with a command xrpl.js has no types for', async function () {
    testContext.mockRippled!.addResponse('log_level', {
      id: 0,
      status: 'success',
      type: 'response',
      result: { status: 'success' },
    })
    const response = await testContext.client.request({
      command: 'log_level',
      severity: 'debug',
    })

    // An untyped command resolves to `BaseResponse`, whose result is `unknown`.
    const result: unknown = response.result
    assert.deepStrictEqual(result, { status: 'success' })
    // @ts-expect-error -- `result` is `unknown` on BaseResponse; it must be narrowed before use
    assert.isUndefined(response.result.severity)
  })

  it('request with a command xrpl.js has no types for and a response type', async function () {
    interface LogLevelResponse {
      id: number | string
      type: 'response'
      result: { status: string }
    }
    testContext.mockRippled!.addResponse('log_level', {
      id: 0,
      status: 'success',
      type: 'response',
      result: { status: 'success' },
    })
    const response = await testContext.client.request<
      { command: 'log_level'; severity: string },
      LogLevelResponse
    >({ command: 'log_level', severity: 'debug' })

    const status: string = response.result.status
    assert.strictEqual(status, 'success')
  })

  it('request rejects keys the command does not declare at compile time', function () {
    // Never called: these calls exist so that the type checker fails the
    // suite if a misspelled request key compiles again. rippled ignores
    // unknown keys, so each of these would otherwise silently do the wrong
    // thing (read the current ledger, return every object).
    async function misspelledKeys(client: Client): Promise<void> {
      await client.request({
        // @ts-expect-error -- `ledger_indx` is not a key of LedgerEntryRequest
        command: 'ledger_entry',
        mpt_issuance: '0000',
        ledger_indx: 'validated',
      })
      await client.request({
        // @ts-expect-error -- `typ` is not a key of AccountObjectsRequest
        command: 'account_objects',
        account: 'r9cZA1mLK5R5Am25ArfXFmqgNwjZgnfk59',
        typ: 'mptoken',
      })
      await client.request({
        // @ts-expect-error -- `limt` is not a key of AccountTxRequest
        command: 'account_tx',
        account: 'r9cZA1mLK5R5Am25ArfXFmqgNwjZgnfk59',
        limt: 5,
      })
    }
    assert.isFunction(misspelledKeys)
  })
})
