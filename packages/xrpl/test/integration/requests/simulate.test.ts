import { assert } from 'chai'

import {
  AccountSet,
  AccountSetTfFlags,
  Payment,
  SimulateRequest,
  Wallet,
} from '../../../src'
import { SimulateBinaryRequest } from '../../../src/models/methods/simulate'
import serverUrl from '../serverUrl'
import {
  setupClient,
  teardownClient,
  type XrplIntegrationTestContext,
} from '../setup'

// how long before each test case times out
const TIMEOUT = 20000

describe('simulate', function () {
  let testContext: XrplIntegrationTestContext

  beforeEach(async () => {
    testContext = await setupClient(serverUrl)
  })
  afterEach(async () => teardownClient(testContext))

  it(
    'json',
    async () => {
      const simulateRequest: SimulateRequest = {
        command: 'simulate',
        tx_json: {
          TransactionType: 'AccountSet',
          Account: testContext.wallet.address,
          NFTokenMinter: testContext.wallet.address,
        },
      }
      const simulateResponse = await testContext.client.request(simulateRequest)

      assert.equal(simulateResponse.type, 'response')
      assert.typeOf(simulateResponse.result.meta, 'object')
      assert.typeOf(simulateResponse.result.tx_json, 'object')
      assert.equal(simulateResponse.result.engine_result, 'tesSUCCESS')
      assert.isFalse(simulateResponse.result.applied)
    },
    TIMEOUT,
  )

  it(
    'binary',
    async () => {
      const simulateRequest: SimulateBinaryRequest = {
        command: 'simulate',
        tx_json: {
          TransactionType: 'AccountSet',
          Account: testContext.wallet.address,
        },
        binary: true,
      }
      const simulateResponse = await testContext.client.request(simulateRequest)

      assert.equal(simulateResponse.type, 'response')
      assert.typeOf(simulateResponse.result.meta_blob, 'string')
      assert.typeOf(simulateResponse.result.tx_blob, 'string')
      assert.equal(simulateResponse.result.engine_result, 'tesSUCCESS')
      assert.isFalse(simulateResponse.result.applied)
    },
    TIMEOUT,
  )

  it(
    'sugar',
    async () => {
      const tx: AccountSet = {
        TransactionType: 'AccountSet',
        Account: testContext.wallet.address,
        NFTokenMinter: testContext.wallet.address,
      }
      const simulateResponse = await testContext.client.simulate(tx)

      assert.equal(simulateResponse.type, 'response')
      assert.typeOf(simulateResponse.result.meta, 'object')
      assert.typeOf(simulateResponse.result.tx_json, 'object')
      assert.equal(simulateResponse.result.engine_result, 'tesSUCCESS')
      assert.isFalse(simulateResponse.result.applied)
    },
    TIMEOUT,
  )

  it(
    'sugar: accepts Flags in interface form',
    async () => {
      // rippled answers `Field 'tx_json.Flags' has bad type.` for the object form, so the sugar
      // converts it the way autofill does before sending.
      const tx: AccountSet = {
        TransactionType: 'AccountSet',
        Account: testContext.wallet.address,
        Flags: { tfRequireDestTag: true },
      }
      const simulateResponse = await testContext.client.simulate(tx)

      assert.equal(simulateResponse.result.engine_result, 'tesSUCCESS')
      assert.strictEqual(
        simulateResponse.result.tx_json.Flags,
        AccountSetTfFlags.tfRequireDestTag,
      )
      // The caller's transaction is left alone.
      assert.deepEqual(tx.Flags, { tfRequireDestTag: true })
    },
    TIMEOUT,
  )

  it(
    'sugar: accepts a Payment that only sets DeliverMax',
    async () => {
      // `DeliverMax` is an RPC-level alias `simulate` does not know:
      // `Field 'tx_json.DeliverMax' is unknown.` autofill folds it into `Amount`; so does this.
      const tx: Payment = {
        TransactionType: 'Payment',
        Account: testContext.wallet.address,
        Destination: Wallet.generate().classicAddress,
        Amount: '20000000',
        DeliverMax: '20000000',
      }
      // @ts-expect-error -- DeliverMax is a non-protocol, RPC level field in Payment transactions
      delete tx.Amount

      const simulateResponse = await testContext.client.simulate(tx)

      assert.equal(simulateResponse.result.engine_result, 'tesSUCCESS')
      assert.strictEqual(simulateResponse.result.tx_json.Amount, '20000000')
      assert.isFalse('DeliverMax' in simulateResponse.result.tx_json)
    },
    TIMEOUT,
  )
})
