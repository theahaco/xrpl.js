import { assert } from 'chai'

import {
  RippledError,
  TimeoutError,
  TransactionFailedError,
  XrplError,
  getTransactionResultCode,
  isTesSuccess,
} from '../../src'
import type { Request } from '../../src'
import { Transaction } from '../../src/models/transactions'
import rippled from '../fixtures/rippled'
import {
  setupClient,
  teardownClient,
  type XrplTestContext,
} from '../setupClient'
import { assertRejects } from '../testUtils'

/** One poll of `waitForFinalTransactionOutcome` sleeps this long before looking the transaction up. */
const LEDGER_CLOSE_TIME = 1000

describe('client.submitAndWait', function () {
  let testContext: XrplTestContext

  beforeEach(async () => {
    testContext = await setupClient()
  })
  afterEach(async () => teardownClient(testContext))

  const signedTransaction: Transaction = {
    TransactionType: 'Payment',
    Sequence: 1,
    LastLedgerSequence: 12312,
    Amount: '20000000',
    Fee: '12',
    SigningPubKey:
      '030E58CDD076E798C84755590AAF6237CA8FAE821070A59F648B517A30DC6F589D',
    TxnSignature:
      '3045022100B3D311371EDAB371CD8F2B661A04B800B61D4B132E09B7B0712D3B2F11B1758302203906B44C4A150311D74FF6A35B146763C0B5B40AC30BD815113F058AA17B3E63',
    Account: 'rhvh5SrgBL5V8oeV9EpDuVszeJSSCEkbPc',
    Destination: 'rQ3PTWGLCbPz8ZCicV5tCX3xuymojTng5r',
  }

  function submitResponse(
    engineResult: string,
    engineResultMessage: string,
  ): Record<string, unknown> {
    return {
      ...rippled.submit.success,
      result: {
        ...rippled.submit.success.result,
        engine_result: engineResult,
        engine_result_message: engineResultMessage,
      },
    }
  }

  function ledgerResponse(ledgerIndex: number): Record<string, unknown> {
    return {
      ...rippled.ledger.normal,
      result: { ...rippled.ledger.normal.result, ledger_index: ledgerIndex },
    }
  }

  function txError(error: string, errorMessage: string) {
    return (request: Request): Record<string, unknown> => ({
      id: request.id,
      status: 'error',
      type: 'response',
      error,
      error_code: 29,
      error_message: errorMessage,
      request,
    })
  }

  const txnNotFound = txError('txnNotFound', 'Transaction not found.')

  const validatedTx = rippled.tx.Payment

  async function assertTransactionFailed(
    promise: Promise<unknown>,
    expected: {
      engineResult: string
      phase: 'submit' | 'expired'
      message?: string | RegExp
    },
  ): Promise<TransactionFailedError> {
    try {
      await promise
    } catch (error) {
      assert(
        error instanceof TransactionFailedError,
        `expected TransactionFailedError, got ${String(error)}`,
      )
      assert(error instanceof XrplError)
      assert.strictEqual(error.name, 'TransactionFailedError')
      assert.strictEqual(error.engineResult, expected.engineResult)
      assert.strictEqual(error.phase, expected.phase)
      if (typeof expected.message === 'string') {
        assert.strictEqual(error.message, expected.message)
      } else if (expected.message instanceof RegExp) {
        assert.match(error.message, expected.message)
      }
      return error
    }
    throw new Error('Expected submitAndWait to reject')
  }

  describe('terminal preliminary results', function () {
    it('throws TransactionFailedError immediately for a tem result', async function () {
      testContext.mockRippled!.addResponse('submit', rippled.submit.temError)

      const started = Date.now()
      const error = await assertTransactionFailed(
        testContext.client.submitAndWait({ ...signedTransaction }),
        {
          engineResult: 'temMALFORMED',
          phase: 'submit',
          message: 'Transaction failed, temMALFORMED: Malformed transaction.',
        },
      )
      assert.strictEqual(error.engineResultMessage, 'Malformed transaction.')
      assert.deepStrictEqual(error.data, rippled.submit.temError.result)
      assert.isBelow(Date.now() - started, LEDGER_CLOSE_TIME)
    })

    it('throws TransactionFailedError immediately for a tef result rippled does not know', async function () {
      testContext.mockRippled!.addResponse(
        'submit',
        submitResponse(
          'tefPAST_SEQ',
          'This sequence number has already passed.',
        ),
      )
      testContext.mockRippled!.addResponse('tx', txnNotFound)

      const started = Date.now()
      const error = await assertTransactionFailed(
        testContext.client.submitAndWait({ ...signedTransaction }),
        {
          engineResult: 'tefPAST_SEQ',
          phase: 'submit',
          message:
            'Transaction failed, tefPAST_SEQ: This sequence number has already passed.',
        },
      )
      assert.strictEqual(
        error.engineResultMessage,
        'This sequence number has already passed.',
      )
      // No polling: the answer must not wait for LastLedgerSequence to pass.
      assert.isBelow(Date.now() - started, LEDGER_CLOSE_TIME)
    })

    it('throws TransactionFailedError immediately for a tel result', async function () {
      testContext.mockRippled!.addResponse(
        'submit',
        submitResponse('telINSUF_FEE_P', 'Fee insufficient.'),
      )
      testContext.mockRippled!.addResponse('tx', txnNotFound)

      const started = Date.now()
      await assertTransactionFailed(
        testContext.client.submitAndWait({ ...signedTransaction }),
        { engineResult: 'telINSUF_FEE_P', phase: 'submit' },
      )
      assert.isBelow(Date.now() - started, LEDGER_CLOSE_TIME)
    })

    it('throws TransactionFailedError for a tef result when rippled only kept the rejected transaction', async function () {
      // rippled keeps a rejected tefPAST_SEQ transaction in its local cache, so `tx` finds it with
      // `validated: false`. That is not "in flight": it must still fail immediately.
      testContext.mockRippled!.addResponse(
        'submit',
        submitResponse(
          'tefPAST_SEQ',
          'This sequence number has already passed.',
        ),
      )
      testContext.mockRippled!.addResponse('tx', {
        ...validatedTx,
        result: { ...validatedTx.result, validated: false },
      })

      const started = Date.now()
      await assertTransactionFailed(
        testContext.client.submitAndWait({ ...signedTransaction }),
        { engineResult: 'tefPAST_SEQ', phase: 'submit' },
      )
      assert.isBelow(Date.now() - started, LEDGER_CLOSE_TIME)
    })

    it('keeps polling for tefALREADY because the transaction is in the open ledger', async function () {
      let txLookups = 0
      testContext.mockRippled!.addResponse(
        'submit',
        submitResponse(
          'tefALREADY',
          'The exact transaction was already in this ledger.',
        ),
      )
      testContext.mockRippled!.addResponse('ledger', ledgerResponse(12300))
      testContext.mockRippled!.addResponse('tx', () => {
        txLookups += 1
        return txLookups < 2
          ? {
              ...validatedTx,
              result: { ...validatedTx.result, validated: false },
            }
          : validatedTx
      })

      const response = await testContext.client.submitAndWait({
        ...signedTransaction,
      })

      assert.strictEqual(response.result.validated, true)
      assert.strictEqual(txLookups, 2)
    })

    it('resolves for a tef result when an earlier submission already got the transaction validated', async function () {
      // Re-submitting the same signed blob after a disconnect answers tefPAST_SEQ / tefALREADY, but the
      // transaction is on the ledger: the caller must get it back, not an error.
      testContext.mockRippled!.addResponse(
        'submit',
        submitResponse(
          'tefPAST_SEQ',
          'This sequence number has already passed.',
        ),
      )
      testContext.mockRippled!.addResponse('tx', validatedTx)

      const started = Date.now()
      const response = await testContext.client.submitAndWait({
        ...signedTransaction,
      })

      assert.strictEqual(response.result.validated, true)
      assert.isBelow(Date.now() - started, LEDGER_CLOSE_TIME)
    })
  })

  describe('polling until validated', function () {
    it('returns a transaction validated in its last allowed ledger even when the validated ledger has moved past it', async function () {
      // Finding 062: LastLedgerSequence is 12312, the validated ledger is already past it, and the
      // transaction *is* validated. It must be returned, not reported as expired.
      testContext.mockRippled!.addResponse('submit', rippled.submit.success)
      testContext.mockRippled!.addResponse('ledger', ledgerResponse(12314))
      testContext.mockRippled!.addResponse('tx', validatedTx)

      const response = await testContext.client.submitAndWait({
        ...signedTransaction,
      })

      assert.strictEqual(response.result.validated, true)
      assert.isTrue(
        isTesSuccess(getTransactionResultCode(response.result.meta)),
      )
    })

    it('keeps polling while the transaction is not found and LastLedgerSequence has not passed', async function () {
      let txLookups = 0
      testContext.mockRippled!.addResponse('submit', rippled.submit.success)
      testContext.mockRippled!.addResponse('ledger', ledgerResponse(12300))
      testContext.mockRippled!.addResponse('tx', (request: Request) => {
        txLookups += 1
        return txLookups < 2 ? txnNotFound(request) : validatedTx
      })

      const response = await testContext.client.submitAndWait({
        ...signedTransaction,
      })

      assert.strictEqual(response.result.validated, true)
      assert.strictEqual(txLookups, 2)
    })

    it('throws TransactionFailedError with phase expired once LastLedgerSequence passes without validation', async function () {
      testContext.mockRippled!.addResponse(
        'submit',
        submitResponse('terQUEUED', 'Held until escalated fee drops.'),
      )
      testContext.mockRippled!.addResponse('ledger', ledgerResponse(12314))
      testContext.mockRippled!.addResponse('tx', txnNotFound)

      const error = await assertTransactionFailed(
        testContext.client.submitAndWait({ ...signedTransaction }),
        {
          engineResult: 'terQUEUED',
          phase: 'expired',
          message:
            "The latest ledger sequence 12314 is greater than the transaction's LastLedgerSequence (12312).\n" +
            'Preliminary result: terQUEUED',
        },
      )
      assert.isUndefined(error.engineResultMessage)
    })

    it('resolves a validated tec result instead of throwing', async function () {
      testContext.mockRippled!.addResponse(
        'submit',
        submitResponse(
          'tecUNFUNDED_PAYMENT',
          'Insufficient XRP balance to send.',
        ),
      )
      testContext.mockRippled!.addResponse('ledger', ledgerResponse(12300))
      testContext.mockRippled!.addResponse('tx', {
        ...validatedTx,
        result: {
          ...validatedTx.result,
          meta: {
            ...validatedTx.result.meta,
            TransactionResult: 'tecUNFUNDED_PAYMENT',
          },
        },
      })

      const response = await testContext.client.submitAndWait({
        ...signedTransaction,
      })

      const code = getTransactionResultCode(response.result.meta)
      assert.strictEqual(code, 'tecUNFUNDED_PAYMENT')
      assert.isFalse(isTesSuccess(code))
    })
  })

  describe('lookup errors while polling', function () {
    it('propagates a RippledError other than txnNotFound with its class and data', async function () {
      testContext.mockRippled!.addResponse('submit', rippled.submit.success)
      testContext.mockRippled!.addResponse('ledger', ledgerResponse(12300))
      testContext.mockRippled!.addResponse(
        'tx',
        txError('tooBusy', 'The server is too busy to help you now.'),
      )

      try {
        await testContext.client.submitAndWait({ ...signedTransaction })
        assert.fail('Expected submitAndWait to reject')
      } catch (error) {
        assert(error instanceof RippledError, String(error))
        assert.strictEqual(
          error.message,
          'The server is too busy to help you now.',
        )

        assert.strictEqual((error.data as { error: string }).error, 'tooBusy')
      }
    })

    it('propagates a TimeoutError from the tx lookup unchanged', async function () {
      testContext.mockRippled!.addResponse('submit', rippled.submit.success)
      testContext.mockRippled!.addResponse('ledger', ledgerResponse(12300))

      const originalRequest = testContext.client.request.bind(
        testContext.client,
      )
      jest
        .spyOn(testContext.client, 'request')
        .mockImplementation(async (request: Request) => {
          if (request.command === 'tx') {
            throw new TimeoutError('tx lookup timed out')
          }
          return originalRequest(request)
        })

      await assertRejects(
        testContext.client.submitAndWait({ ...signedTransaction }),
        TimeoutError,
        'tx lookup timed out',
      )
    })

    it('wraps a non-library error from the tx lookup in an XrplError that keeps the cause', async function () {
      testContext.mockRippled!.addResponse('submit', rippled.submit.success)
      testContext.mockRippled!.addResponse('ledger', ledgerResponse(12300))

      const originalRequest = testContext.client.request.bind(
        testContext.client,
      )
      const cause = new Error('socket exploded')
      jest
        .spyOn(testContext.client, 'request')
        .mockImplementation(async (request: Request) => {
          if (request.command === 'tx') {
            throw cause
          }
          return originalRequest(request)
        })

      try {
        await testContext.client.submitAndWait({ ...signedTransaction })
        assert.fail('Expected submitAndWait to reject')
      } catch (error) {
        assert(error instanceof XrplError, String(error))
        assert.notInstanceOf(error, TransactionFailedError)
        assert.match(
          error.message,
          /^Failed to look up transaction [0-9A-F]{64}/u,
        )
        assert.notMatch(error.message, /undefined/u)
        assert.include(error.message, 'Preliminary result: tesSUCCESS')
        assert.strictEqual(error.data, cause)
      }
    })
  })
})
