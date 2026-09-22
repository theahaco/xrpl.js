import { assert } from 'chai'

import { MPTokenIssuanceCreate } from '../../src'

import serverUrl from './serverUrl'
import {
  setupClient,
  teardownClient,
  type XrplIntegrationTestContext,
} from './setup'
import { isAmendmentEnabled } from './utils'

// how long before each test case times out
const TIMEOUT = 20000

describe('amendments', function () {
  let testContext: XrplIntegrationTestContext

  beforeEach(async () => {
    testContext = await setupClient(serverUrl)
  })
  afterEach(async () => teardownClient(testContext))

  it(
    'isAmendmentEnabled sees an amendment that the `feature` RPC reports as disabled',
    async () => {
      // MPTokensV1 is listed in .ci-config/xrpld.cfg, so the transaction below is one
      // the server knows how to apply.
      const probe: MPTokenIssuanceCreate = {
        TransactionType: 'MPTokenIssuanceCreate',
        Account: testContext.wallet.classicAddress,
        AssetScale: 2,
      }
      assert.isTrue(
        await isAmendmentEnabled(testContext.client, probe),
        'MPTokensV1 should be in force',
      )

      // ...and yet `feature` says it is not. A standalone node applies [features] as
      // rules in force from the genesis ledger without writing the ledger's Amendments
      // object, so `enabled` is false for every amendment however it was configured.
      // This is why `isAmendmentEnabled` probes behaviour instead of reading `feature`.
      const response = await testContext.client.request({ command: 'feature' })
      const mptokens = Object.values(response.result.features).filter(
        (feature) => feature.name === 'MPTokensV1',
      )
      assert.lengthOf(mptokens, 1, 'MPTokensV1 should be known to the server')
      assert.isFalse(
        mptokens[0].enabled,
        'the `feature` RPC is not a usable source of truth on a standalone node',
      )
    },
    TIMEOUT,
  )
})
