import { assert } from 'chai'

import { Client, RippledError } from '../../src'
import createMockRippled, {
  type MockedWebSocketServer,
} from '../createMockRippled'
import { assertRejects, destroyServer, getFreePort } from '../testUtils'

/**
 * `server_info` failing after the websocket is up must not be reported through
 * the process console: `getServerInfo()` rejects, and `connect()` reports the
 * failure through the client's `error` event while still resolving.
 */
/* eslint-disable no-console -- asserting that nothing is written to the console */
describe('client.getServerInfo', function () {
  let port: number
  let mockRippled: MockedWebSocketServer
  let client: Client

  beforeEach(async () => {
    port = await getFreePort()
    mockRippled = createMockRippled(port)
    // Deliberately no `server_info` response: the mock answers with an error.
    mockRippled.suppressOutput = true
    client = new Client(`ws://localhost:${port}`)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await client.disconnect()
    await new Promise<void>((resolve) => {
      mockRippled.close(() => resolve())
    })
    await destroyServer(port)
  })

  it('rejects when server_info fails instead of writing to the console', async function () {
    const errors: unknown[][] = []
    client.on('error', (...args: unknown[]) => {
      errors.push(args)
    })
    await client.connection.connect()

    await assertRejects(client.getServerInfo(), RippledError)

    assert.isUndefined(client.networkID)
    assert.isUndefined(client.buildVersion)
    expect(console.error).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('connect() still resolves and emits `error` when server_info fails', async function () {
    const errors: unknown[][] = []
    client.on('error', (...args: unknown[]) => {
      errors.push(args)
    })

    await client.connect()

    assert.isTrue(client.isConnected())
    assert.lengthOf(errors, 1)
    assert.strictEqual(errors[0][0], 'server_info')
    assert.isString(errors[0][1])
    assert.instanceOf(errors[0][2], RippledError)
    expect(console.error).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  })
})
/* eslint-enable no-console */
