import { assert } from 'chai'

import { XrplError, NotFoundError, RippledError } from '../../src'
import rippled from '../fixtures/rippled'
import {
  setupClient,
  teardownClient,
  type XrplTestContext,
} from '../setupClient'

describe('client errors', function () {
  it('XrplError with data', async function () {
    const error = new XrplError('_message_', '_data_')
    assert.strictEqual(error.toString(), '[XrplError(_message_, "_data_")]')
  })

  it('NotFoundError default message', async function () {
    const error = new NotFoundError()
    assert.strictEqual(error.toString(), '[NotFoundError(Not found)]')
  })

  it('RippledError exposes the rippled error code', async function () {
    const error = new RippledError('Entry not found.', {
      error: 'entryNotFound',
      error_code: 98,
      error_message: 'Entry not found.',
      status: 'error',
      type: 'response',
      index: 'F258E5',
    })
    assert.strictEqual(error.code, 'entryNotFound')
    assert.strictEqual(error.data.error, 'entryNotFound')
    assert.strictEqual(error.data.error_code, 98)
    assert.strictEqual(error.data.index, 'F258E5')
    assert.strictEqual(error.message, 'Entry not found.')
  })

  it('RippledError without a rippled response', async function () {
    const error = new RippledError('Client not connected')
    assert.strictEqual(error.code, undefined)
    assert.deepEqual(error.data, {})
  })
})

describe('client errors from rippled', function () {
  let testContext: XrplTestContext

  beforeEach(async () => {
    testContext = await setupClient()
  })
  afterEach(async () => teardownClient(testContext))

  it('RippledError.data is the typed error response', async function () {
    testContext.mockRippled!.addResponse('subscribe', rippled.subscribe.error)

    try {
      await testContext.client.request({
        command: 'subscribe',
        streams: ['validations'],
      })
      assert.fail('request should have thrown')
    } catch (error) {
      if (!(error instanceof RippledError)) {
        throw error
      }
      assert.strictEqual(error.code, 'invalidParams')
      assert.strictEqual(error.data.error, 'invalidParams')
      assert.strictEqual(error.data.error_code, 31)
      assert.strictEqual(error.data.status, 'error')
      assert.strictEqual(error.data.request?.command, 'subscribe')
    }
  })
})
