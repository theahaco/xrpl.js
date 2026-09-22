import { assert } from 'chai'

import { Client, NotConnectedError } from '../../src'
import {
  FaucetNetwork,
  faucetNetworkPaths,
  getFaucetHost,
  getFaucetPath,
} from '../../src/Wallet/defaultFaucets'
import {
  setupClient,
  teardownClient,
  type XrplTestContext,
} from '../setupClient'
import { assertRejects } from '../testUtils'

describe('Get Faucet host ', function () {
  let testContext: XrplTestContext

  beforeEach(async () => {
    testContext = await setupClient()
  })
  afterEach(async () => teardownClient(testContext))

  it('returns the Devnet host', function () {
    const expectedFaucet = FaucetNetwork.Devnet
    testContext.client.networkID = 2

    assert.strictEqual(getFaucetHost(testContext.client), expectedFaucet)
  })

  it('returns the Testnet host', function () {
    const expectedFaucet = FaucetNetwork.Testnet
    testContext.client.networkID = 1

    assert.strictEqual(getFaucetHost(testContext.client), expectedFaucet)
  })

  it('returns the correct faucetPath for Devnet host', function () {
    const expectedFaucetPath = faucetNetworkPaths[FaucetNetwork.Devnet]
    testContext.client.networkID = 2

    assert.strictEqual(
      getFaucetPath(getFaucetHost(testContext.client)),
      expectedFaucetPath,
    )
  })

  it('returns the correct faucetPath for undefined host', function () {
    const expectedFaucetPath = '/accounts'

    assert.strictEqual(getFaucetPath(undefined), expectedFaucetPath)
  })

  it('throws if connected to mainnet', function () {
    testContext.client.networkID = 0
    assert.throws(() => getFaucetHost(testContext.client))
  })

  it('throws if not connected to a known faucet host', function () {
    testContext.client.networkID = 300
    assert.throws(() => getFaucetHost(testContext.client))
  })
})

describe('fundWallet', function () {
  it('throws NotConnectedError when the client is not connected', async function () {
    const client = new Client('wss://s:1')
    await assertRejects(
      client.fundWallet(),
      NotConnectedError,
      'Client not connected, cannot call faucet',
    )
  })
})
