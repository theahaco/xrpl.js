import { assert } from 'chai'

import { XrplError, TransactionFailedError } from '../../src'
import { Transaction } from '../../src/models/transactions'
import rippled from '../fixtures/rippled'
import {
  setupClient,
  teardownClient,
  type XrplTestContext,
} from '../setupClient'
import { assertRejects } from '../testUtils'

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

  it('should exit early with a tem error', async function () {
    const signedTx = { ...signedTransaction }

    testContext.mockRippled!.addResponse('submit', rippled.submit.temError)

    await assertRejects(
      testContext.client.submitAndWait(signedTx),
      XrplError,
      'Transaction failed, temMALFORMED: Malformed transaction.',
    )
  })

  const validatedTx = rippled.tx.Payment

  function addSubmission(engineResult = 'tesSUCCESS'): void {
    testContext.mockRippled!.addResponse('submit', {
      ...rippled.submit.success,
      result: {
        ...rippled.submit.success.result,
        engine_result: engineResult,
      },
    })
    testContext.mockRippled!.addResponse('ledger', {
      ...rippled.ledger.normal,
      result: { ...rippled.ledger.normal.result, ledger_index: 12300 },
    })
  }

  ;['tefPAST_SEQ', 'telINSUF_FEE_P'].forEach((engineResult) => {
    it(`keeps polling after preliminary ${engineResult} until validated`, async function () {
      addSubmission(engineResult)
      let txLookups = 0
      testContext.mockRippled!.addResponse('tx', () => {
        txLookups += 1
        return txLookups === 1
          ? {
              ...validatedTx,
              result: { ...validatedTx.result, validated: false },
            }
          : validatedTx
      })

      const response = await testContext.client.submitAndWait(signedTransaction)

      assert.strictEqual(response.result.validated, true)
      assert.strictEqual(response.result.meta.TransactionResult, 'tesSUCCESS')
      assert.strictEqual(txLookups, 2)
    })
  })

  it('keeps polling after txnNotFound', async function () {
    addSubmission()
    let txLookups = 0
    testContext.mockRippled!.addResponse('tx', (request) => {
      txLookups += 1
      return txLookups === 1
        ? {
            id: request.id,
            status: 'error',
            type: 'response',
            error: 'txnNotFound',
            error_code: 29,
            error_message: 'Transaction not found.',
            request,
          }
        : validatedTx
    })

    const response = await testContext.client.submitAndWait(signedTransaction)

    assert.strictEqual(response.result.validated, true)
    assert.strictEqual(txLookups, 2)
  })

  it('requests API v2 for the promised response shape even when client.apiVersion is 1', async function () {
    addSubmission()
    testContext.client.apiVersion = 1
    let lookupVersion: number | undefined
    testContext.mockRippled!.addResponse('tx', (request) => {
      lookupVersion = request.api_version
      return validatedTx
    })

    const response = await testContext.client.submitAndWait(signedTransaction)

    assert.strictEqual(lookupVersion, 2)
    assert.strictEqual(response.result.validated, true)
    assert.strictEqual(response.result.tx_json.TransactionType, 'Payment')
    assert.strictEqual(response.result.meta.TransactionResult, 'tesSUCCESS')
  })
  ;[undefined, null, 'DEADBEEF', []].forEach((meta) => {
    it(`rejects validated responses without decoded metadata: ${JSON.stringify(meta)}`, async function () {
      addSubmission()
      const originalRequest = testContext.client.request.bind(
        testContext.client,
      )
      jest
        .spyOn(testContext.client, 'request')
        .mockImplementation(async (request) => {
          if (request.command === 'tx') {
            return {
              ...validatedTx,
              result: { ...validatedTx.result, meta },
            }
          }
          return originalRequest(request)
        })

      await assertRejects(
        testContext.client.submitAndWait(signedTransaction),
        XrplError,
        'Validated transaction response must include decoded metadata.',
      )
    })
  })

  it('throws a structured error for an unsuccessful validated result', async function () {
    addSubmission('tecUNFUNDED_PAYMENT')
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

    try {
      await testContext.client.submitAndWait(signedTransaction)
      assert.fail('Expected unsuccessful transaction to throw')
    } catch (error) {
      assert.instanceOf(error, TransactionFailedError)
      if (!(error instanceof TransactionFailedError)) {
        throw error
      }
      assert.strictEqual(error.phase, 'validated')
      assert.strictEqual(error.engineResult, 'tecUNFUNDED_PAYMENT')
      assert.strictEqual(error.response?.result.validated, true)
    }
  })
  it('returns an explicit failed result from trySubmitAndWait', async function () {
    addSubmission('tecUNFUNDED_PAYMENT')
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
    const result = await testContext.client.trySubmitAndWait(signedTransaction)
    assert.isFalse(result.ok)
    assert.instanceOf(result.error, TransactionFailedError)
  })

  it('returns an explicit successful response from trySubmitAndWait', async function () {
    addSubmission()
    testContext.mockRippled!.addResponse('tx', validatedTx)
    const result = await testContext.client.trySubmitAndWait(signedTransaction)
    assert.isTrue(result.ok)
    assert.strictEqual(result.response.result.validated, true)
  })

  it('returns malformed submission errors rather than throwing from the try method', async function () {
    testContext.mockRippled!.addResponse('submit', rippled.submit.temError)
    const result = await testContext.client.trySubmitAndWait(signedTransaction)
    assert.isFalse(result.ok)
    assert.instanceOf(result.error, XrplError)
  })
})
