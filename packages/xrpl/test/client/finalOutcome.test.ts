import { Client, RippledError, TransactionFailedError } from '../../src'
import { waitForFinalTransactionOutcome } from '../../src/sugar/submit'

describe('final transaction outcome lookup', () => {
  const client = new Client('ws://localhost:6006')
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it('finds a transaction validated in its last ledger before declaring expiry', async () => {
    jest.spyOn(client, 'getLedgerIndex').mockResolvedValue(102)
    const response = {
      result: { validated: true, meta: { TransactionResult: 'tesSUCCESS' } },
    }
    const request = jest
      .spyOn(client, 'request')
      .mockResolvedValue(response as never)
    const pending = waitForFinalTransactionOutcome(
      client,
      'hash',
      100,
      'tesSUCCESS',
    )
    await jest.advanceTimersByTimeAsync(1000)
    expect(await pending).toBe(response)
    expect(request).toHaveBeenCalledWith({
      command: 'tx',
      transaction: 'hash',
      api_version: 2,
    })
  })

  it('returns a structured expiry only after a missing-transaction response', async () => {
    jest.spyOn(client, 'getLedgerIndex').mockResolvedValue(102)
    jest
      .spyOn(client, 'request')
      .mockRejectedValue(new RippledError('missing', { error: 'txnNotFound' }))
    const pending = waitForFinalTransactionOutcome(
      client,
      'hash',
      100,
      'tefBAD_QUORUM',
    ).catch(async (error: unknown): Promise<unknown> => error)
    await jest.advanceTimersByTimeAsync(1000)
    const error = await pending
    expect(error).toBeInstanceOf(TransactionFailedError)
    expect(error).toMatchObject({
      phase: 'expired',
      engineResult: 'tefBAD_QUORUM',
    })
    expect(error).toHaveProperty('response', undefined)
  })

  it('preserves lookup errors even after the expiry ledger has passed', async () => {
    const error = new RippledError('server is busy', { error: 'tooBusy' })
    jest.spyOn(client, 'getLedgerIndex').mockResolvedValue(102)
    jest.spyOn(client, 'request').mockRejectedValue(error)
    const pending = waitForFinalTransactionOutcome(
      client,
      'hash',
      100,
      'terQUEUED',
    ).catch(async (failure: unknown): Promise<unknown> => failure)
    await jest.advanceTimersByTimeAsync(1000)
    expect(await pending).toBe(error)
  })
})
