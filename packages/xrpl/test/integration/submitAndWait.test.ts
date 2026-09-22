import { assert } from 'chai'

import {
  AccountSet,
  convertStringToHex,
  getTransactionResultCode,
  isTesSuccess,
  Payment,
  TransactionFailedError,
  ValidationError,
} from '../../src'
import { assertRejects } from '../testUtils'

import serverUrl from './serverUrl'
import {
  setupClient,
  teardownClient,
  type XrplIntegrationTestContext,
} from './setup'
import { GENESIS_ACCOUNT, getXRPBalance, ledgerAccept } from './utils'

// how long before each test case times out
const TIMEOUT = 60000

/** One poll of `waitForFinalTransactionOutcome` sleeps this long before looking the transaction up. */
const LEDGER_CLOSE_TIME = 1000

describe('client.submitAndWait', function () {
  let testContext: XrplIntegrationTestContext

  beforeEach(async () => {
    testContext = await setupClient(serverUrl)
  })
  afterEach(async () => teardownClient(testContext))

  async function delayedLedgerAccept(): Promise<unknown> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 1000)
    })
    return ledgerAccept(testContext.client)
  }

  it(
    'submitAndWait an unsigned transaction',
    async () => {
      const accountSet: AccountSet = {
        TransactionType: 'AccountSet',
        Account: testContext.wallet.classicAddress,
        Domain: convertStringToHex('example.com'),
      }

      let retries = 10

      while (retries > 0) {
        retries -= 1
        const responsePromise = testContext.client.submitAndWait(accountSet, {
          wallet: testContext.wallet,
        })
        const ledgerPromise = delayedLedgerAccept()

        try {
          // eslint-disable-next-line no-await-in-loop -- Testing purposes
          const [response, _ledger] = await Promise.all([
            responsePromise,
            ledgerPromise,
          ])

          assert.equal(response.type, 'response')
          assert.equal(response.result.validated, true)
          retries = 0
          break
        } catch (err) {
          if (!(err instanceof TransactionFailedError)) {
            throw err
          }

          // Retry if another transaction finished before this one

          if (['tefPAST_SEQ', 'tefMAX_LEDGER'].includes(err.engineResult)) {
            // eslint-disable-next-line no-await-in-loop, no-promise-executor-return -- We are waiting on retries
            await new Promise((resolve) => setTimeout(resolve, 1000))
          } else {
            retries = 0
            break
          }
        }
      }
    },
    TIMEOUT,
  )

  it(
    'should throw a ValidationError when submitting an unsigned transaction without a wallet',
    async () => {
      const accountSet: AccountSet = {
        TransactionType: 'AccountSet',
        Account: testContext.wallet.classicAddress,
        Domain: convertStringToHex('example.com'),
      }

      await assertRejects(
        testContext.client.submitAndWait(accountSet),
        ValidationError,
        'Wallet must be provided when submitting an unsigned transaction',
      )
    },
    TIMEOUT,
  )

  it(
    'submitAndWait a signed transaction',
    async () => {
      const accountSet: AccountSet = {
        TransactionType: 'AccountSet',
        Account: testContext.wallet.classicAddress,
        Domain: convertStringToHex('example.com'),
      }
      const { tx_blob: signedAccountSet } = testContext.wallet.sign(
        await testContext.client.autofill(accountSet),
      )
      const responsePromise = testContext.client.submitAndWait(signedAccountSet)
      const ledgerPromise = delayedLedgerAccept()
      return Promise.all([responsePromise, ledgerPromise]).then(
        ([response, _ledger]) => {
          assert.equal(response.type, 'response')
          assert.equal(response.result.validated, true)
        },
      )
    },
    TIMEOUT,
  )

  it(
    'submitAndWait a signed transaction longer',
    async () => {
      const accountSet: AccountSet = {
        TransactionType: 'AccountSet',
        Account: testContext.wallet.classicAddress,
        Domain: convertStringToHex('example.com'),
      }
      const { tx_blob: signedAccountSet } = testContext.wallet.sign(
        await testContext.client.autofill(accountSet),
      )
      const responsePromise = testContext.client.submitAndWait(signedAccountSet)
      const ledgerPromise = delayedLedgerAccept()
      return Promise.all([responsePromise, ledgerPromise]).then(
        ([response, _ledger]) => {
          assert.equal(response.type, 'response')
          assert.equal(response.result.validated, true)
        },
      )
    },
    TIMEOUT,
  )

  async function signAccountSet(
    overrides: Partial<AccountSet> = {},
  ): Promise<string> {
    const accountSet: AccountSet = {
      TransactionType: 'AccountSet',
      Account: testContext.wallet.classicAddress,
      Domain: convertStringToHex('example.com'),
    }
    const autofilled = await testContext.client.autofill(accountSet)
    return testContext.wallet.sign({ ...autofilled, ...overrides }).tx_blob
  }

  it(
    'returns a transaction validated in its last allowed ledger even when the validated ledger has moved past it',
    async () => {
      // Finding 062: LastLedgerSequence = validated + 1, and two ledgers close between the submission and the
      // first poll. The transaction is in ledger validated + 1, so it must be returned, not reported as expired.
      const validated = await testContext.client.getLedgerIndex()
      const signed = await signAccountSet({ LastLedgerSequence: validated + 1 })

      const responsePromise = testContext.client.submitAndWait(signed)
      // Give the `submit` round trip time to land in the open ledger, then close two ledgers before the
      // poll's LEDGER_CLOSE_TIME sleep ends.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 200)
      })
      await ledgerAccept(testContext.client)
      await ledgerAccept(testContext.client)

      const response = await responsePromise
      assert.equal(response.result.validated, true)
      assert.equal(response.result.ledger_index, validated + 1)
      assert.isTrue(
        isTesSuccess(getTransactionResultCode(response.result.meta)),
      )
      assert.isAtLeast(await testContext.client.getLedgerIndex(), validated + 2)
    },
    TIMEOUT,
  )

  it(
    'throws TransactionFailedError immediately for tefPAST_SEQ instead of waiting for expiry',
    async () => {
      const accountSet: AccountSet = {
        TransactionType: 'AccountSet',
        Account: testContext.wallet.classicAddress,
        Domain: convertStringToHex('example.com'),
      }
      const autofilled = await testContext.client.autofill(accountSet)
      const stale = await signAccountSet({
        Sequence: (autofilled.Sequence ?? 1) - 1,
      })

      const started = Date.now()
      try {
        await testContext.client.submitAndWait(stale)
        assert.fail('Expected submitAndWait to reject')
      } catch (error) {
        assert(error instanceof TransactionFailedError, String(error))
        assert.strictEqual(error.engineResult, 'tefPAST_SEQ')
        assert.strictEqual(error.phase, 'submit')
        assert.isString(error.engineResultMessage)
      }
      // No ledger closes in standalone mode unless the test asks for them, so before the fix this
      // call could only end by expiry (never) or the jest timeout.
      assert.isBelow(Date.now() - started, LEDGER_CLOSE_TIME)
    },
    TIMEOUT,
  )

  it(
    'resolves when re-submitting a signed blob that an earlier submission already got validated',
    async () => {
      const signed = await signAccountSet()
      const first = await Promise.all([
        testContext.client.submitAndWait(signed),
        delayedLedgerAccept(),
      ]).then(([response]) => response)
      assert.equal(first.result.validated, true)

      // rippled answers tefPAST_SEQ (or tefALREADY) to the re-submission; the transaction is on the ledger.
      const second = await testContext.client.submitAndWait(signed)
      assert.equal(second.result.validated, true)
      assert.equal(second.result.hash, first.result.hash)
    },
    TIMEOUT,
  )

  it(
    'resolves a validated tec result instead of throwing',
    async () => {
      const balance = await getXRPBalance(
        testContext.client,
        testContext.wallet,
      )
      const payment: Payment = {
        TransactionType: 'Payment',
        Account: testContext.wallet.classicAddress,
        Destination: GENESIS_ACCOUNT,
        // more than the account holds: applied as tecUNFUNDED_PAYMENT, fee charged
        Amount: (BigInt(balance) * BigInt(2)).toString(),
      }

      const [response] = await Promise.all([
        testContext.client.submitAndWait(payment, {
          wallet: testContext.wallet,
        }),
        delayedLedgerAccept(),
      ])

      assert.equal(response.result.validated, true)
      const code = getTransactionResultCode(response.result.meta)
      assert.strictEqual(code, 'tecUNFUNDED_PAYMENT')
      assert.isFalse(isTesSuccess(code))
    },
    TIMEOUT,
  )
})
