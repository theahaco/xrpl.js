import { assert } from 'chai'

import { Batch, Payment, Wallet } from '../../../src'
import { BatchFlags } from '../../../src/models/transactions/batch'
import { BATCH_INNER_NOT_APPLIED } from '../../../src/sugar/getBatchResults'
import { getBatchInnerHashes } from '../../../src/utils'
import serverUrl from '../serverUrl'
import {
  setupClient,
  teardownClient,
  type XrplIntegrationTestContext,
} from '../setup'
import { generateFundedWallet, ledgerAccept } from '../utils'

// how long before each test case times out
const TIMEOUT = 20000

describe('Batch outcomes', function () {
  let testContext: XrplIntegrationTestContext
  let destination: Wallet

  beforeAll(async () => {
    testContext = await setupClient(serverUrl)
    destination = await generateFundedWallet(testContext.client)
  }, TIMEOUT)
  afterAll(async () => teardownClient(testContext))

  function innerPayment(): Payment {
    return {
      TransactionType: 'Payment',
      Flags: 0x40000000,
      Account: testContext.wallet.classicAddress,
      Destination: destination.classicAddress,
      Amount: '10000000',
    }
  }

  async function submitBatch(batch: Batch): Promise<string> {
    const responsePromise = testContext.client.submitAndWait(batch, {
      wallet: testContext.wallet,
    })
    const ledgerPromise = new Promise<void>((resolve) => {
      setTimeout(resolve, 1000)
    }).then(async () => ledgerAccept(testContext.client))
    const [response] = await Promise.all([responsePromise, ledgerPromise])

    assert.equal(
      typeof response.result.meta === 'object'
        ? response.result.meta.TransactionResult
        : undefined,
      'tesSUCCESS',
      'the outer Batch reports tesSUCCESS',
    )
    return response.result.hash
  }

  it(
    'reports every inner transaction as not-applied when tfAllOrNothing reverts, though the outer Batch is tesSUCCESS',
    async () => {
      const bad = innerPayment()
      // A Sequence the account will not reach makes this inner transaction fail,
      // which under tfAllOrNothing reverts every inner transaction in the Batch.
      const accountInfo = await testContext.client.request({
        command: 'account_info',
        account: testContext.wallet.classicAddress,
      })
      bad.Sequence = accountInfo.result.account_data.Sequence + 50

      const batch: Batch = {
        TransactionType: 'Batch',
        Account: testContext.wallet.classicAddress,
        Flags: BatchFlags.tfAllOrNothing,
        RawTransactions: [innerPayment(), bad].map((rawTx) => ({
          RawTransaction: rawTx,
        })),
      }
      const autofilled = await testContext.client.autofill(batch)
      const hash = await submitBatch(autofilled)

      const results = await testContext.client.getBatchResults(hash)

      assert.deepEqual(
        results.map((result) => result.result),
        [BATCH_INNER_NOT_APPLIED, BATCH_INNER_NOT_APPLIED],
        'both inner transactions were reverted',
      )
      assert.deepEqual(
        results.map((result) => result.hash),
        getBatchInnerHashes(autofilled),
      )
    },
    TIMEOUT,
  )

  it(
    'reports applied inner transactions with their own result and ParentBatchID',
    async () => {
      const batch: Batch = {
        TransactionType: 'Batch',
        Account: testContext.wallet.classicAddress,
        Flags: BatchFlags.tfAllOrNothing,
        RawTransactions: [innerPayment(), innerPayment()].map((rawTx) => ({
          RawTransaction: rawTx,
        })),
      }
      const autofilled = await testContext.client.autofill(batch)
      const hash = await submitBatch(autofilled)

      const results = await testContext.client.getBatchResults(autofilled)

      assert.deepEqual(
        results.map((result) => result.result),
        ['tesSUCCESS', 'tesSUCCESS'],
      )
      for (const result of results) {
        const meta = result.tx?.result.meta
        assert.equal(
          typeof meta === 'object' ? meta.ParentBatchID : undefined,
          hash,
          'each applied inner transaction points back at the outer Batch',
        )
      }
    },
    TIMEOUT,
  )
})
