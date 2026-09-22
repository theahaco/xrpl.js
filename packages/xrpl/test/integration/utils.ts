import BigNumber from 'bignumber.js'
import { assert } from 'chai'
import omit from 'lodash/omit'
import throttle from 'lodash/throttle'
import { decode } from 'ripple-binary-codec'

import {
  Client,
  Wallet,
  AccountInfoRequest,
  type SubmitResponse,
  type TxResponse,
  TimeoutError,
  NotConnectedError,
  ECDSA,
  AccountLinesRequest,
  IssuedCurrency,
  XRP,
  getTransactionResultCode,
} from '../../src'
import {
  AMMCreate,
  AccountSet,
  AccountSetAsfFlags,
  Payment,
  SubmittableTransaction,
  Transaction,
  TrustSet,
  TrustSetFlags,
} from '../../src/models/transactions'
import { hashSignedTx } from '../../src/utils/hashes'

export const GENESIS_ACCOUNT = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh'
const GENESIS_SECRET = 'snoPBrXtMeMyMHUVTgbuqAfg1SUTb'

export async function sendLedgerAccept(client: Client): Promise<unknown> {
  return client.connection.request({ command: 'ledger_accept' })
}

/**
 * Throttles an async function in a way that can be awaited.
 * By default throttle doesn't return a promise for async functions unless it's invoking them immediately.
 *
 * @param func - async function to throttle calls for.
 * @param wait - same function as lodash.throttle's wait parameter. Call this function at most this often.
 * @returns a promise which will be resolved/ rejected only if the function is executed, with the result of the underlying call.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Proper
function asyncThrottle<F extends (...args: any[]) => Promise<unknown>>(
  func: F,
  wait?: number,
): (...args: Parameters<F>) => ReturnType<F> {
  const throttled = throttle((resolve, reject, args: Parameters<F>) => {
    func(...args)
      .then(resolve)
      .catch(reject)
  }, wait)
  const ret = (...args: Parameters<F>): ReturnType<F> =>
    new Promise((resolve, reject) => {
      throttled(resolve, reject, args)
    }) as ReturnType<F>
  return ret
}

const throttledLedgerAccept = asyncThrottle(sendLedgerAccept, 1000)

export async function ledgerAccept(
  client: Client,
  retries?: number,
  shouldThrottle?: boolean,
): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    const ledgerAcceptFunc = shouldThrottle
      ? throttledLedgerAccept
      : sendLedgerAccept
    ledgerAcceptFunc(client)
      .then(resolve)
      .catch((error) => {
        if (retries === undefined) {
          setTimeout(() => {
            resolve(ledgerAccept(client, 10))
          }, 1000)
        } else if (retries > 0) {
          setTimeout(() => {
            resolve(ledgerAccept(client, retries - 1))
          }, 1000)
        } else {
          reject(error)
        }
      })
  })
}

export function subscribeDone(client: Client): void {
  client.removeAllListeners()
}

/**
 * Checks whether an amendment is in force on the server the tests are connected to.
 *
 * The `feature` RPC cannot answer this on a standalone node. `.ci-config/xrpld.cfg`
 * enables amendments through its `[features]` stanza, which applies them as rules in
 * force from the genesis ledger without writing the ledger's `Amendments` object, so
 * `feature` reports every amendment as `enabled: false` even when it is in effect.
 * The only reliable check is to ask the server to apply a transaction that is only
 * valid when the amendment is in force: `temDISABLED` means the amendment is off.
 *
 * `simulate` is used rather than `submit` so nothing reaches the ledger, which means
 * the probe needs no funded account, no sequence and no fee.
 *
 * @param client - The XRPL client.
 * @param probeTransaction - A transaction the server rejects with `temDISABLED` when,
 *                           and only when, the amendment under test is not in force.
 *                           It does not have to be otherwise valid: any result other
 *                           than `temDISABLED` means the amendment is in force.
 * @returns True if the amendment is in force, false otherwise.
 *
 * @example
 * const enabled = await isAmendmentEnabled(client, {
 *   TransactionType: 'MPTokenIssuanceCreate',
 *   Account: wallet.classicAddress,
 * })
 */
export async function isAmendmentEnabled(
  client: Client,
  probeTransaction: SubmittableTransaction,
): Promise<boolean> {
  const response = await client.simulate(probeTransaction)
  return response.result.engine_result !== 'temDISABLED'
}

export async function submitTransaction({
  client,
  transaction,
  wallet,
  retry = { count: 5, delayMs: 1000 },
}: {
  client: Client
  transaction: SubmittableTransaction
  wallet: Wallet
  retry?: {
    count: number
    delayMs: number
  }
}): Promise<SubmitResponse> {
  let response: SubmitResponse
  try {
    response = await client.submit(transaction, { wallet })

    // Retry if another transaction finished before this one
    while (
      ['tefPAST_SEQ', 'tefMAX_LEDGER'].includes(
        response.result.engine_result,
      ) &&
      retry.count > 0
    ) {
      // eslint-disable-next-line no-param-reassign -- we want to decrement the count
      retry.count -= 1
      // eslint-disable-next-line no-await-in-loop, no-promise-executor-return -- We are waiting on retries
      await new Promise((resolve) => setTimeout(resolve, retry.delayMs))
      // eslint-disable-next-line no-await-in-loop -- We are retrying in a loop on purpose
      response = await client.submit(transaction, { wallet })
    }
  } catch (error) {
    if (error instanceof TimeoutError || error instanceof NotConnectedError) {
      // retry
      return submitTransaction({
        client,
        transaction,
        wallet,
        retry: {
          ...retry,
          count: retry.count > 0 ? retry.count - 1 : 0,
        },
      })
    }

    throw error
  }

  return response
}

export async function fundAccount(
  client: Client,
  wallet: Wallet,
  retry?: {
    count: number
    delayMs: number
  },
): Promise<SubmitResponse> {
  const payment: Payment = {
    TransactionType: 'Payment',
    Account: GENESIS_ACCOUNT,
    Destination: wallet.classicAddress,
    // 2 times the amount needed for a new account (20 XRP)
    Amount: '400000000',
  }
  const wal = Wallet.fromSeed(GENESIS_SECRET, { algorithm: ECDSA.secp256k1 })
  const response = await submitTransaction({
    client,
    wallet: wal,
    transaction: payment,
    retry,
  })

  if (response.result.engine_result !== 'tesSUCCESS') {
    // eslint-disable-next-line no-console -- happens only when something goes wrong
    console.log(response)
    assert.fail(`Response not successful, ${response.result.engine_result}`)
  }
  await ledgerAccept(client)
  const signedTx = omit(response.result.tx_json, 'hash')
  await verifySubmittedTransaction(client, signedTx as Transaction)
  return response
}

export async function generateFundedWallet(client: Client): Promise<Wallet> {
  const wallet = Wallet.generate()
  await fundAccount(client, wallet)
  return wallet
}

export async function verifySubmittedTransaction(
  client: Client,
  tx: Transaction | string,
  hashTx?: string,
): Promise<void> {
  const hash = hashTx ?? hashSignedTx(tx)
  const data = await client.request({
    command: 'tx',
    transaction: hash,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: handle this API change for 2.0.0
  const decodedTx: any = typeof tx === 'string' ? decode(tx) : tx
  if (decodedTx.TransactionType === 'Payment') {
    decodedTx.DeliverMax = decodedTx.Amount
    delete decodedTx.Amount
  }

  assert(data.result)
  assert.isTrue(
    data.result.validated,
    `Transaction ${hash} is not in a validated ledger`,
  )
  assert.deepEqual(
    omit(data.result.tx_json, [
      'ctid',
      'date',
      'hash',
      'inLedger',
      'ledger_index',
      'meta',
      'validated',
    ]),
    decodedTx,
  )
  if (typeof data.result.meta === 'object') {
    assert.strictEqual(data.result.meta.TransactionResult, 'tesSUCCESS')
  } else {
    assert.strictEqual(data.result.meta, 'tesSUCCESS')
  }
}

/**
 * The outcome of a transaction sent by {@link testTransaction}.
 *
 * The inherited `result.engine_result` is the *preliminary* code the `submit` method
 * returned, which is only a prediction: a transaction can be submitted with
 * `tesSUCCESS` and still be validated with a `tec*` code, and vice versa. Read
 * `finalResult` for the code the network actually recorded.
 */
export interface TestTransactionResponse extends SubmitResponse {
  // The `tx` response for the transaction, from the validated ledger it landed in.
  // Absent only when the expected `errCode` was a `tem*`, `tef*`, `tel*` or `ter*`
  // code, none of which ever reach a ledger.
  validatedResponse?: TxResponse
  // The engine result code from the validated metadata, e.g. `tesSUCCESS` or
  // `tecNO_PERMISSION`. This is the outcome that actually happened. Absent for the
  // same reason as `validatedResponse`.
  finalResult?: string
}

/**
 * Sends a test transaction for integration testing and waits for it to be validated.
 *
 * Transactions go out through `submitAndWait`, so this resolves only once the
 * transaction is in a validated ledger and every assertion is made against the result
 * recorded there rather than against the preliminary `submit` code. `setupClient`
 * closes ledgers in the background, which is what lets `submitAndWait` make progress
 * against a standalone node.
 *
 * @param client - The XRPL client
 * @param transaction - The transaction object to send.
 * @param wallet - The wallet to send the transaction from.
 * @param retry - As of Sep 2022, xrpl.js does not track requests sent in parallel. Our sequence numbers can get off from
 *               the server's sequence numbers. This is a fix to retry the transaction if it fails due to tefPAST_SEQ.
 * @param retry.count - How many times the request should be retried.
 * @param retry.delayMs - How long to wait between retries.
 * @param errCode - When this parameter is defined, it signifies the transaction should fail with the expected
 *                  errCode (e.g. tecNO_PERMISSION). A `tec*` code is asserted against the validated result; the
 *                  other classes of failure never reach a ledger, so they are asserted against the `submit` result.
 * @returns The response of the transaction.
 */
// eslint-disable-next-line max-params -- Test function, many params are needed
export async function testTransaction(
  client: Client,
  transaction: SubmittableTransaction,
  wallet: Wallet,
  retry?: {
    count: number
    delayMs: number
  },
  errCode?: string,
): Promise<TestTransactionResponse> {
  // sign/submit the transaction
  const response = await submitTransaction({
    client,
    wallet,
    transaction,
    retry,
  })

  // check that the transaction was successful
  assert.equal(response.type, 'response')

  // `tem*`, `tef*`, `tel*` and `ter*` transactions are never applied to a ledger, so
  // the preliminary result is the only outcome there is to assert against.
  if (errCode != null && !errCode.startsWith('tec')) {
    assert.equal(response.result.engine_result, errCode)
    return response
  }

  // Close the ledger the transaction went into, then wait for it through
  // `submitAndWait`. Re-submitting a blob whose transaction is already validated is
  // what `submitAndWait` is built for: rippled answers `tefPAST_SEQ` and the validated
  // transaction is returned. Closing the ledger first is what makes that deterministic
  // - a blob that is still only in the open ledger also draws `tefPAST_SEQ`, which
  // `submitAndWait` can only report as a failure.
  await ledgerAccept(client)
  const validatedResponse = await client.submitAndWait(response.result.tx_blob)
  const finalResult = getTransactionResultCode(validatedResponse.result.meta)
  assert.isTrue(
    validatedResponse.result.validated,
    `Transaction ${validatedResponse.result.hash} was not validated`,
  )

  if (errCode != null) {
    assert.equal(
      finalResult,
      errCode,
      `Expected the validated result to be ${errCode} but got ${finalResult}`,
    )
    return { ...response, validatedResponse, finalResult }
  }

  if (finalResult !== 'tesSUCCESS') {
    // eslint-disable-next-line no-console -- See output
    console.error(
      `Transaction was not successful. Expected the validated result to be tesSUCCESS but got ${finalResult}`,
    )
    // eslint-disable-next-line no-console -- See output
    console.error('The transaction was: ', transaction)
    // eslint-disable-next-line no-console -- See output
    console.error('The submit response was: ', JSON.stringify(response))
  }

  assert.equal(finalResult, 'tesSUCCESS', response.result.engine_result_message)

  // check that the transaction on the ledger is the one that was signed
  const signedTx = omit(response.result.tx_json, 'hash')
  await verifySubmittedTransaction(client, signedTx as Transaction)
  return { ...response, validatedResponse, finalResult }
}

export async function getXRPBalance(
  client: Client,
  account: string | Wallet,
): Promise<string> {
  const address: string =
    typeof account === 'string' ? account : account.classicAddress
  const request: AccountInfoRequest = {
    command: 'account_info',
    account: address,
  }
  return (await client.request(request)).result.account_data.Balance
}

/**
 * Retrieves the close time of the ledger.
 *
 * @param client - The client object.
 * @returns - A promise that resolves to the close time of the ledger.
 *
 * @example
 * const closeTime = await getLedgerCloseTime(client);
 * console.log(closeTime); // Output: 1626424978
 */
export async function getLedgerCloseTime(client: Client): Promise<number> {
  const CLOSE_TIME: number = (
    await client.request({
      command: 'ledger',
      ledger_index: 'validated',
    })
  ).result.ledger.close_time

  return CLOSE_TIME
}

/**
 * Waits for the ledger time to reach a specific value and forces ledger progress if necessary.
 *
 * @param client - The client object.
 * @param ledgerTime - The target ledger time.
 * @param [retries=20] - The number of retries before throwing an error.
 * @returns - A promise that resolves when the ledger time reaches the target value.
 *
 * @example
 * try {
 *   await waitForAndForceProgressLedgerTime(client, 1626424978, 10);
 *   console.log('Ledger time reached.'); // Output: Ledger time reached.
 * } catch (error) {
 *   console.error(error);
 * }
 */
export async function waitForAndForceProgressLedgerTime(
  client: Client,
  ledgerTime: number,
  retries = 20,
): Promise<void> {
  async function getCloseTime(): Promise<boolean> {
    const CLOSE_TIME: number = await getLedgerCloseTime(client)
    if (CLOSE_TIME >= ledgerTime) {
      return true
    }

    return false
  }

  let retryCounter = retries || 0

  while (retryCounter > 0) {
    // eslint-disable-next-line no-await-in-loop -- Necessary for retries
    if (await getCloseTime()) {
      return
    }

    // eslint-disable-next-line no-await-in-loop -- Necessary for retries
    await ledgerAccept(client)
    retryCounter -= 1
  }

  throw new Error(`Ledger time not reached after ${retries} retries.`)
}

export async function getIOUBalance(
  client: Client,
  wallet: Wallet,
  currency: IssuedCurrency,
): Promise<string> {
  const request: AccountLinesRequest = {
    command: 'account_lines',
    account: wallet.classicAddress,
    peer: currency.issuer,
  }
  return (await client.request(request)).result.lines[0].balance
}

export async function createAMMPool(
  client: Client,
  enableAMMClawback = false,
): Promise<{
  issuerWallet: Wallet
  lpWallet: Wallet
  asset: XRP
  asset2: IssuedCurrency
}> {
  const lpWallet = await generateFundedWallet(client)
  const issuerWallet = await generateFundedWallet(client)
  const currencyCode = 'USD'

  const accountSetTx: AccountSet = {
    TransactionType: 'AccountSet',
    Account: issuerWallet.classicAddress,
    SetFlag: AccountSetAsfFlags.asfDefaultRipple,
  }

  await testTransaction(client, accountSetTx, issuerWallet)

  if (enableAMMClawback) {
    const accountSetTx2: AccountSet = {
      TransactionType: 'AccountSet',
      Account: issuerWallet.classicAddress,
      SetFlag: AccountSetAsfFlags.asfAllowTrustLineClawback,
    }

    await testTransaction(client, accountSetTx2, issuerWallet)
  }

  const trustSetTx: TrustSet = {
    TransactionType: 'TrustSet',
    Flags: TrustSetFlags.tfClearNoRipple,
    Account: lpWallet.classicAddress,
    LimitAmount: {
      currency: currencyCode,
      issuer: issuerWallet.classicAddress,
      value: '1000',
    },
  }

  await testTransaction(client, trustSetTx, lpWallet)

  const paymentTx: Payment = {
    TransactionType: 'Payment',
    Account: issuerWallet.classicAddress,
    Destination: lpWallet.classicAddress,
    Amount: {
      currency: currencyCode,
      issuer: issuerWallet.classicAddress,
      value: '500',
    },
  }

  await testTransaction(client, paymentTx, issuerWallet)

  const ammCreateTx: AMMCreate = {
    TransactionType: 'AMMCreate',
    Account: lpWallet.classicAddress,
    Amount: '250',
    Amount2: {
      currency: currencyCode,
      issuer: issuerWallet.classicAddress,
      value: '250',
    },
    TradingFee: 12,
  }

  await testTransaction(client, ammCreateTx, lpWallet)

  const asset: XRP = { currency: 'XRP' }
  const asset2: IssuedCurrency = {
    currency: currencyCode,
    issuer: issuerWallet.classicAddress,
  }

  return {
    issuerWallet,
    lpWallet,
    asset,
    asset2,
  }
}

export async function fetchAccountReserveFee(
  client: Client,
): Promise<string | null> {
  const response = await client.request({ command: 'server_state' })
  const fee = response.result.state.validated_ledger?.reserve_base

  if (fee == null) {
    return null
  }

  return new BigNumber(fee).dp(0, BigNumber.ROUND_CEIL).toString(10)
}
