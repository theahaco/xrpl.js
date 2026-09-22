import { assert } from 'chai'

import { Batch, decode, Payment, Wallet } from '../../../src'
import { BatchFlags } from '../../../src/models/transactions/batch'
import {
  combineBatchSigners,
  signMultiBatch,
  verifyBatchSigners,
} from '../../../src/Wallet/batchSigner'
import serverUrl from '../serverUrl'
import {
  setupClient,
  teardownClient,
  type XrplIntegrationTestContext,
} from '../setup'
import {
  generateFundedWallet,
  testTransaction,
  verifySubmittedTransaction,
} from '../utils'

// how long before each test case times out
const TIMEOUT = 20000

describe('Batch', function () {
  let testContext: XrplIntegrationTestContext
  let destination: Wallet
  let wallet2: Wallet
  let wallet3: Wallet

  async function testBatchTransaction(
    batch: Batch,
    wallet: Wallet,
    retry?: {
      count: number
      delayMs: number
    },
  ): Promise<void> {
    await testTransaction(testContext.client, batch, wallet, retry)
    const promises: Array<Promise<void>> = []
    for (const rawTx of batch.RawTransactions) {
      promises.push(
        verifySubmittedTransaction(testContext.client, rawTx.RawTransaction),
      )
    }
    await Promise.all(promises)
  }

  beforeAll(async () => {
    testContext = await setupClient(serverUrl)
    wallet2 = await generateFundedWallet(testContext.client)
    wallet3 = await generateFundedWallet(testContext.client)
    destination = await generateFundedWallet(testContext.client)
  }, TIMEOUT)
  afterAll(async () => teardownClient(testContext))

  it(
    'base',
    async () => {
      const payment: Payment = {
        TransactionType: 'Payment',
        Flags: 0x40000000,
        Account: testContext.wallet.classicAddress,
        Destination: destination.classicAddress,
        Amount: '10000000',
      }
      const tx: Batch = {
        TransactionType: 'Batch',
        Account: testContext.wallet.classicAddress,
        Flags: BatchFlags.tfAllOrNothing,
        RawTransactions: [payment, { ...payment }, { ...payment }].map(
          (rawTx) => ({
            RawTransaction: rawTx,
          }),
        ),
      }
      const autofilled = await testContext.client.autofill(tx)
      await testBatchTransaction(autofilled, testContext.wallet)
    },
    TIMEOUT,
  )

  it(
    'batch multisign',
    async () => {
      const payment: Payment = {
        TransactionType: 'Payment',
        Flags: 0x40000000,
        Account: testContext.wallet.classicAddress,
        Destination: destination.classicAddress,
        Amount: '10000000',
      }
      const payment2: Payment = { ...payment, Account: wallet2.classicAddress }
      const tx: Batch = {
        TransactionType: 'Batch',
        Account: testContext.wallet.classicAddress,
        Flags: BatchFlags.tfAllOrNothing,
        RawTransactions: [payment, payment2].map((rawTx) => ({
          RawTransaction: rawTx,
        })),
      }
      const autofilled = await testContext.client.autofill(tx, 1)
      signMultiBatch(wallet2, autofilled)
      await testBatchTransaction(autofilled, testContext.wallet)
    },
    TIMEOUT,
  )

  it(
    'batch with two co-signers combined',
    async () => {
      const payment: Payment = {
        TransactionType: 'Payment',
        Flags: 0x40000000,
        Account: testContext.wallet.classicAddress,
        Destination: destination.classicAddress,
        Amount: '10000000',
      }
      const tx: Batch = {
        TransactionType: 'Batch',
        Account: testContext.wallet.classicAddress,
        Flags: BatchFlags.tfAllOrNothing,
        RawTransactions: [
          payment,
          { ...payment, Account: wallet2.classicAddress },
          { ...payment, Account: wallet3.classicAddress },
        ].map((rawTx) => ({ RawTransaction: rawTx })),
      }
      // Autofill once, then hand the same Batch to each co-signer: the
      // signatures bind the outer sequence and the inner transaction IDs.
      const autofilled = await testContext.client.autofill(tx, 2)

      const fragment1 = { ...autofilled }
      const fragment2 = { ...autofilled }
      signMultiBatch(wallet2, fragment1)
      signMultiBatch(wallet3, fragment2)

      const combined = decode(
        combineBatchSigners([fragment1, fragment2]),
      ) as unknown as Batch
      assert.lengthOf(combined.BatchSigners ?? [], 2)
      assert.deepEqual(
        verifyBatchSigners(combined).map((result) => result.valid),
        [true, true],
      )

      await testBatchTransaction(combined, testContext.wallet)
    },
    TIMEOUT,
  )
})
