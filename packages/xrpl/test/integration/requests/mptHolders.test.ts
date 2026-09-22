import { assert } from 'chai'

import { MPTHoldersRequest, RippledError } from '../../../src'
import serverUrl from '../serverUrl'
import {
  setupClient,
  teardownClient,
  type XrplIntegrationTestContext,
} from '../setup'

// how long before each test case times out
const TIMEOUT = 20000

describe('mpt_holders', function () {
  let testContext: XrplIntegrationTestContext

  beforeEach(async () => {
    testContext = await setupClient(serverUrl)
  })
  afterEach(async () => teardownClient(testContext))

  it(
    'is not served by rippled and surfaces as a typed unknownCmd error',
    async () => {
      const request: MPTHoldersRequest = {
        command: 'mpt_holders',
        mpt_issuance_id: '00000000000000000000000000000000000000000000000B',
      }
      try {
        await testContext.client.request(request)
        assert.fail('rippled should not serve mpt_holders')
      } catch (error) {
        if (!(error instanceof RippledError)) {
          throw error
        }
        assert.equal(error.code, 'unknownCmd')
        assert.equal(error.data.error, 'unknownCmd')
        assert.equal(error.data.status, 'error')
        assert.equal(error.data.request?.command, 'mpt_holders')
      }
    },
    TIMEOUT,
  )
})
