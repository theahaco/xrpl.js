import { assert } from 'chai'

import { Batch, Payment, TicketCreate, Wallet } from '../../src'
import { BatchFlags } from '../../src/models/transactions/batch'

import serverUrl from './serverUrl'
import {
  setupClient,
  teardownClient,
  type XrplIntegrationTestContext,
} from './setup'
import {
  generateFundedWallet,
  testTransaction,
  verifySubmittedTransaction,
} from './utils'

// how long before each test case times out
const TIMEOUT = 20000

/**
 * Ticketed transactions and Batch inner sequences through `Client.autofill`.
 *
 * Each case submits what autofill produced and checks that the transactions
 * were actually applied, not merely that the submission was accepted.
 */
describe('client.autofill (tickets and Batch sequences)', function () {
  let testContext: XrplIntegrationTestContext
  let destination: Wallet
  let tickets: number[]

  async function accountSequence(): Promise<number> {
    const response = await testContext.client.request({
      command: 'account_info',
      account: testContext.wallet.classicAddress,
      ledger_index: 'current',
    })
    return response.result.account_data.Sequence
  }

  function innerPayment(amount: string): Payment {
    return {
      TransactionType: 'Payment',
      Flags: 0x40000000,
      Account: testContext.wallet.classicAddress,
      Destination: destination.classicAddress,
      Amount: amount,
    }
  }

  async function verifyInnerTransactions(batch: Batch): Promise<void> {
    await Promise.all(
      batch.RawTransactions.map(async (rawTx) =>
        verifySubmittedTransaction(testContext.client, rawTx.RawTransaction),
      ),
    )
  }

  beforeAll(async () => {
    testContext = await setupClient(serverUrl)
    destination = await generateFundedWallet(testContext.client)

    const ticketCreate: TicketCreate = {
      TransactionType: 'TicketCreate',
      Account: testContext.wallet.classicAddress,
      TicketCount: 4,
    }
    await testTransaction(testContext.client, ticketCreate, testContext.wallet)
    const response = await testContext.client.request({
      command: 'account_objects',
      account: testContext.wallet.classicAddress,
      type: 'ticket',
    })
    tickets = response.result.account_objects
      .map((ticket) => {
        return 'TicketSequence' in ticket ? ticket.TicketSequence : 0
      })
      .sort((first, second) => first - second)
    assert.lengthOf(tickets, 4)
  }, TIMEOUT)
  afterAll(async () => teardownClient(testContext))

  it(
    'sets Sequence 0 on a ticketed transaction, which then applies',
    async () => {
      const tx: Payment = {
        TransactionType: 'Payment',
        Account: testContext.wallet.classicAddress,
        Destination: destination.classicAddress,
        Amount: '1000000',
        TicketSequence: tickets[0],
      }
      const autofilled = await testContext.client.autofill(tx)
      assert.strictEqual(autofilled.Sequence, 0)
      assert.strictEqual(autofilled.TicketSequence, tickets[0])

      await testTransaction(testContext.client, autofilled, testContext.wallet)
    },
    TIMEOUT,
  )

  it(
    'sets Sequence 0 on a ticketed inner Batch transaction, which then applies',
    async () => {
      const tx: Batch = {
        TransactionType: 'Batch',
        Account: testContext.wallet.classicAddress,
        Flags: BatchFlags.tfAllOrNothing,
        RawTransactions: [
          {
            RawTransaction: {
              ...innerPayment('1000000'),
              TicketSequence: tickets[1],
            },
          },
          { RawTransaction: innerPayment('2000000') },
        ],
      }
      const autofilled = await testContext.client.autofill(tx)
      const [ticketed, sequenced] = autofilled.RawTransactions
      assert.strictEqual(ticketed.RawTransaction.Sequence, 0)
      assert.strictEqual(ticketed.RawTransaction.TicketSequence, tickets[1])
      // The ticketed inner consumes no sequence number.
      assert.strictEqual(
        sequenced.RawTransaction.Sequence,
        (autofilled.Sequence ?? 0) + 1,
      )

      await testTransaction(testContext.client, autofilled, testContext.wallet)
      await verifyInnerTransactions(autofilled)
    },
    TIMEOUT,
  )

  it(
    'starts the inner sequences at the account Sequence when the outer Batch is ticketed',
    async () => {
      const tx: Batch = {
        TransactionType: 'Batch',
        Account: testContext.wallet.classicAddress,
        Flags: BatchFlags.tfAllOrNothing,
        TicketSequence: tickets[2],
        RawTransactions: [
          { RawTransaction: innerPayment('1000000') },
          { RawTransaction: innerPayment('2000000') },
        ],
      }
      const sequence = await accountSequence()
      const autofilled = await testContext.client.autofill(tx)
      assert.strictEqual(autofilled.Sequence, 0)
      // A ticketed outer consumes no sequence number, so no +1 for the inner ones.
      assert.strictEqual(
        autofilled.RawTransactions[0].RawTransaction.Sequence,
        sequence,
      )
      assert.strictEqual(
        autofilled.RawTransactions[1].RawTransaction.Sequence,
        sequence + 1,
      )

      await testTransaction(testContext.client, autofilled, testContext.wallet)
      await verifyInnerTransactions(autofilled)
    },
    TIMEOUT,
  )

  it(
    'recomputes the inner sequences when the same Batch object is autofilled again',
    async () => {
      const tx: Batch = {
        TransactionType: 'Batch',
        Account: testContext.wallet.classicAddress,
        Flags: BatchFlags.tfAllOrNothing,
        RawTransactions: [
          { RawTransaction: innerPayment('1000000') },
          { RawTransaction: innerPayment('2000000') },
        ],
      }
      const first = await testContext.client.autofill(tx)
      await testTransaction(testContext.client, first, testContext.wallet)
      await verifyInnerTransactions(first)

      // The caller's object was not touched by the first autofill...
      tx.RawTransactions.forEach((rawTx) => {
        assert.strictEqual(rawTx.RawTransaction.Sequence, undefined)
        assert.strictEqual(rawTx.RawTransaction.Fee, undefined)
      })

      // ...so the retry gets fresh inner sequences and applies as well.
      const second = await testContext.client.autofill(tx)
      // The first batch consumed three sequence numbers: the outer and two inner.
      assert.strictEqual(second.Sequence, (first.Sequence ?? 0) + 3)
      second.RawTransactions.forEach((rawTx, index) => {
        assert.strictEqual(
          rawTx.RawTransaction.Sequence,
          (second.Sequence ?? 0) + index + 1,
        )
      })
      await testTransaction(testContext.client, second, testContext.wallet)
      await verifyInnerTransactions(second)
    },
    TIMEOUT,
  )
})
