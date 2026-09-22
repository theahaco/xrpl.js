import { assert } from 'chai'

import {
  Client,
  MPTokenAuthorize,
  MPTokenIssuanceCreate,
  MPTokenIssuanceCreateFlags,
  Payment,
  SubmittableTransaction,
  TransactionMetadata,
  getBalanceChanges,
} from '../../src'

import serverUrl from './serverUrl'
import {
  setupClient,
  teardownClient,
  type XrplIntegrationTestContext,
} from './setup'
import { testTransaction, generateFundedWallet } from './utils'

// how long before each test case times out
const TIMEOUT = 20000

/**
 * Look a validated transaction up by hash and return its metadata.
 *
 * @param client - The client to look the transaction up with.
 * @param hash - The hash of the validated transaction.
 * @returns The metadata of that transaction.
 */
async function getMetadata<T extends SubmittableTransaction>(
  client: Client,
  hash: string,
): Promise<TransactionMetadata<T>> {
  const response = await client.request({ command: 'tx', transaction: hash })
  return response.result.meta as TransactionMetadata<T>
}

describe('getBalances and getBalanceChanges with MPTs', function () {
  let testContext: XrplIntegrationTestContext

  beforeEach(async () => {
    testContext = await setupClient(serverUrl)
  })
  afterEach(async () => teardownClient(testContext))

  it(
    'reports an MPT holding and the balance changes that created it',
    async () => {
      const issuer = testContext.wallet
      const holder = await generateFundedWallet(testContext.client)

      const createTx: MPTokenIssuanceCreate = {
        TransactionType: 'MPTokenIssuanceCreate',
        Account: issuer.classicAddress,
        Flags: MPTokenIssuanceCreateFlags.tfMPTCanTransfer,
        MaximumAmount: '1000',
      }
      const createRes = await testTransaction(
        testContext.client,
        createTx,
        issuer,
      )
      const mptIssuanceID = (
        await getMetadata<MPTokenIssuanceCreate>(
          testContext.client,
          createRes.result.tx_json.hash!,
        )
      ).mpt_issuance_id

      assert.isString(mptIssuanceID)

      // The holder has to opt in before it can be paid.
      const authorizeTx: MPTokenAuthorize = {
        TransactionType: 'MPTokenAuthorize',
        Account: holder.classicAddress,
        MPTokenIssuanceID: mptIssuanceID!,
      }
      await testTransaction(testContext.client, authorizeTx, holder)

      const paymentTx: Payment = {
        TransactionType: 'Payment',
        Account: issuer.classicAddress,
        Destination: holder.classicAddress,
        Amount: {
          mpt_issuance_id: mptIssuanceID!,
          value: '100',
        },
      }
      const paymentRes = await testTransaction(
        testContext.client,
        paymentTx,
        issuer,
      )

      // getBalances used to omit MPT holdings entirely.
      const holderBalances = await testContext.client.getBalances(
        holder.classicAddress,
      )
      assert.deepInclude(holderBalances, {
        currency: 'MPT',
        mpt_issuance_id: mptIssuanceID,
        value: '100',
      })

      // `peer` keeps the MPTs of that issuer...
      const byIssuer = await testContext.client.getBalances(
        holder.classicAddress,
        { peer: issuer.classicAddress },
      )
      assert.deepEqual(byIssuer, [
        {
          currency: 'MPT',
          mpt_issuance_id: mptIssuanceID,
          value: '100',
        },
      ])

      // ...and drops the MPTs of anybody else.
      const byOther = await testContext.client.getBalances(
        holder.classicAddress,
        { peer: holder.classicAddress },
      )
      assert.deepEqual(byOther, [])

      // getBalanceChanges used to report only the XRP fee for an MPT payment.
      const changes = getBalanceChanges(
        await getMetadata(testContext.client, paymentRes.result.tx_json.hash!),
      )
      const holderChange = changes.find(
        (change) => change.account === holder.classicAddress,
      )
      assert.deepEqual(holderChange!.balances, [
        {
          currency: 'MPT',
          mpt_issuance_id: mptIssuanceID,
          value: '100',
        },
      ])

      const issuerChange = changes.find(
        (change) => change.account === issuer.classicAddress,
      )
      assert.deepInclude(issuerChange!.balances, {
        currency: 'MPT',
        mpt_issuance_id: mptIssuanceID,
        value: '-100',
      })
    },
    TIMEOUT,
  )
})
