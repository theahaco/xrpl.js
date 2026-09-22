import fs from 'fs'
import path from 'path'

import { assert } from 'chai'

import {
  AMMDeposit,
  AMMDepositFlags,
  Client,
  IssuedCurrency,
  SignerListSet,
  Wallet,
  XChainBridge,
  XChainCreateBridge,
  XRP,
} from '../../src'

import serverUrl from './serverUrl'
import {
  GENESIS_ACCOUNT,
  createAMMPool,
  fundAccount,
  generateFundedWallet,
  sendLedgerAccept,
  testTransaction,
} from './utils'

export interface TestAMMPool {
  issuerWallet: Wallet
  lpWallet: Wallet
  testWallet: Wallet
  asset: XRP
  asset2: IssuedCurrency
}

interface TestBridge {
  xchainBridge: XChainBridge
  witness: Wallet
  signatureReward: string
}

export interface XrplIntegrationTestContext {
  client: Client
  wallet: Wallet

  /** Stops the background ledger ticker started by `setupClient`. */
  stopLedgerTicker?: () => void
}

/**
 * How often the background ticker closes a ledger. A standalone node never closes one
 * by itself, so without this nothing that waits for validation - `submitAndWait` above
 * all - would ever finish.
 */
const LEDGER_TICK_MS = 1000

/** Path to the xrpld config CI mounts into the node the tests run against. */
const CI_CONFIG_PATH = path.resolve(
  __dirname,
  '../../../../.ci-config/xrpld.cfg',
)

/**
 * Closes a ledger every `LEDGER_TICK_MS` until the returned function is called.
 *
 * @param client - A connected client.
 * @returns A function that stops the ticker.
 */
function startLedgerTicker(client: Client): () => void {
  const timer = setInterval(() => {
    if (!client.isConnected()) {
      return
    }
    // Nothing awaits this: a ledger that fails to close is retried on the next tick,
    // and a rejection here must not fail an unrelated test.
    sendLedgerAccept(client).catch(() => {
      // Ignore - the next tick tries again.
    })
  }, LEDGER_TICK_MS)
  // Do not hold the event loop open if a suite forgets to tear its context down.
  timer.unref()
  return () => {
    clearInterval(timer)
  }
}

/**
 * Reads the amendment names listed in the `[features]` stanza of an xrpld config.
 *
 * @param configText - The full text of an xrpld.cfg file.
 * @returns The amendment names listed under `[features]`.
 */
function parseFeaturesStanza(configText: string): string[] {
  const lines = configText.split('\n')
  const start = lines.findIndex((line) => line.trim() === '[features]')
  if (start === -1) {
    return []
  }
  const names: string[] = []
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim()
    if (trimmed.startsWith('[')) {
      break
    }
    if (trimmed !== '' && !trimmed.startsWith('#')) {
      names.push(trimmed)
    }
  }
  return names
}

// The check below only needs to run once per process, not once per suite.
let amendmentsChecked = false

/**
 * Fails if the node under test supports an amendment that `.ci-config/xrpld.cfg` does
 * not enable, naming the ones that are missing.
 *
 * Tests run against whatever image CI starts, so an amendment the image gained but the
 * config never listed is silently inactive: suites covering it fail with `temDISABLED`
 * in whatever order they happen to run, far from the cause. Amendments the node reports
 * as `vetoed: "Obsolete"` are retired - permanently in force and impossible to list -
 * so they are skipped.
 *
 * @param client - A connected client.
 */
async function assertAmendmentsAreEnabled(client: Client): Promise<void> {
  // eslint-disable-next-line n/no-sync -- test setup; reading the config is not worth a hop
  if (amendmentsChecked || !fs.existsSync(CI_CONFIG_PATH)) {
    return
  }
  amendmentsChecked = true

  const listed = new Set(
    // eslint-disable-next-line n/no-sync -- test setup; reading the config is not worth a hop
    parseFeaturesStanza(fs.readFileSync(CI_CONFIG_PATH, 'utf-8')),
  )
  const response = await client.request({ command: 'feature' })
  const missing = Object.values(response.result.features)
    .filter(
      (feature) =>
        feature.supported &&
        (feature as { vetoed?: boolean | string }).vetoed !== 'Obsolete' &&
        !listed.has(feature.name),
    )
    .map((feature) => feature.name)
    .sort((left, right) => left.localeCompare(right))

  assert.deepEqual(
    missing,
    [],
    `${missing.length} amendment(s) supported by the node under test are missing from .ci-config/xrpld.cfg: ${missing.join(
      ', ',
    )}. Add them to the [features] stanza; see CONTRIBUTING.md, "Updating the Docker container for CI".`,
  )
}

export async function teardownClient(
  context: XrplIntegrationTestContext,
): Promise<void> {
  context.stopLedgerTicker?.()
  context.client.removeAllListeners()
  return context.client.disconnect()
}

async function connectWithRetry(client: Client, tries = 0): Promise<void> {
  return client.connect().catch(async (error) => {
    if (tries < 10) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(connectWithRetry(client, tries + 1))
        }, 1000)
      })
    }

    throw error
  })
}

/**
 * Connects a client to the standalone node and funds a wallet for the suite.
 *
 * @param server - The WebSocket URL to connect to.
 * @param opts - Options.
 * @param opts.closeLedgers - Whether to close a ledger in the background every
 *                            `LEDGER_TICK_MS`, which is what lets `submitAndWait` make
 *                            progress. Pass `false` in a suite that drives ledger
 *                            closes itself and asserts on exactly which ledger a
 *                            transaction landed in.
 * @returns The test context.
 */
export async function setupClient(
  server = serverUrl,
  opts: { closeLedgers?: boolean } = {},
): Promise<XrplIntegrationTestContext> {
  const closeLedgers = opts.closeLedgers ?? true
  const client = new Client(server, { timeout: 200000 })
  const wallet = Wallet.generate()
  return connectWithRetry(client).then(async () => {
    const stopLedgerTicker = closeLedgers
      ? startLedgerTicker(client)
      : (): void => {
          // No ticker to stop.
        }
    try {
      await assertAmendmentsAreEnabled(client)
      await fundAccount(client, wallet, {
        count: 20,
        delayMs: 1000,
      })
    } catch (error) {
      // Leave nothing behind holding the event loop open, or jest hangs instead of
      // reporting the failure.
      stopLedgerTicker()
      client.removeAllListeners()
      await client.disconnect()
      throw error
    }
    const context: XrplIntegrationTestContext = {
      client,
      wallet,
      stopLedgerTicker,
    }
    return context
  })
}

export async function setupAMMPool(client: Client): Promise<TestAMMPool> {
  const testAMMPool = await createAMMPool(client)
  const { issuerWallet, lpWallet, asset, asset2 } = testAMMPool

  const testWallet = await generateFundedWallet(client)

  // Need to deposit (be an LP) to make bid/vote/withdraw eligible in tests for testContext.wallet
  const ammDepositTx: AMMDeposit = {
    TransactionType: 'AMMDeposit',
    Account: testWallet.classicAddress,
    Asset: asset,
    Asset2: asset2,
    Amount: '1000',
    Flags: AMMDepositFlags.tfSingleAsset,
  }

  await testTransaction(client, ammDepositTx, testWallet)

  return {
    issuerWallet,
    lpWallet,
    testWallet,
    asset,
    asset2,
  }
}

export async function setupBridge(client: Client): Promise<TestBridge> {
  const doorAccount = await generateFundedWallet(client)
  const signatureReward = '200'
  const xchainBridge: XChainBridge = {
    LockingChainDoor: doorAccount.classicAddress,
    LockingChainIssue: { currency: 'XRP' },
    IssuingChainDoor: GENESIS_ACCOUNT,
    IssuingChainIssue: { currency: 'XRP' },
  }
  const setupTx: XChainCreateBridge = {
    TransactionType: 'XChainCreateBridge',
    Account: doorAccount.classicAddress,
    XChainBridge: xchainBridge,
    SignatureReward: signatureReward,
    MinAccountCreateAmount: '10000000',
  }

  await testTransaction(client, setupTx, doorAccount)

  // confirm that the transaction actually went through
  const accountObjectsResponse = await client.request({
    command: 'account_objects',
    account: doorAccount.classicAddress,
    type: 'bridge',
  })
  assert.lengthOf(
    accountObjectsResponse.result.account_objects,
    1,
    'Should be exactly one bridge owned by the account',
  )

  const witnessWallet = await generateFundedWallet(client)

  const signerTx: SignerListSet = {
    TransactionType: 'SignerListSet',
    Account: doorAccount.classicAddress,
    SignerEntries: [
      {
        SignerEntry: {
          Account: witnessWallet.classicAddress,
          SignerWeight: 1,
        },
      },
    ],
    SignerQuorum: 1,
  }
  await testTransaction(client, signerTx, doorAccount)

  const signerAccountInfoResponse = await client.request({
    command: 'account_info',
    account: doorAccount.classicAddress,
    signer_lists: true,
  })
  const signerListInfo = signerAccountInfoResponse.result.signer_lists?.[0]
  assert.deepEqual(
    signerListInfo?.SignerEntries,
    signerTx.SignerEntries,
    'SignerEntries were not set properly',
  )
  assert.equal(
    signerListInfo?.SignerQuorum,
    signerTx.SignerQuorum,
    'SignerQuorum was not set properly',
  )

  return { xchainBridge, witness: witnessWallet, signatureReward }
}
