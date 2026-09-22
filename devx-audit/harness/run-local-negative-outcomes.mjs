import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as baseline from 'xrpl'

const root = path.dirname(fileURLToPath(import.meta.url))
const auditRoot = path.resolve(root, '..')
const configuredSdkEntry = process.env.XRPL_SDK_ENTRY || process.argv[2]
const repositorySdkEntry = path.resolve(root, '../../packages/xrpl/dist/npm/index.js')
const prototypeEntry = configuredSdkEntry
  ? path.resolve(configuredSdkEntry)
  : fs.existsSync(repositorySdkEntry)
    ? repositorySdkEntry
    : path.join(auditRoot, 'worktrees/xrpl.js/packages/xrpl/dist/npm/index.js')
const configuredPortalPath = process.env.XRPL_PORTAL_PATH
if (configuredPortalPath && !path.isAbsolute(configuredPortalPath)) {
  throw new Error('XRPL_PORTAL_PATH must be an absolute path to the portal repository')
}
const siblingPortalPath = path.resolve(root, '../../../xrpl-dev-portal')
const portalRoot = configuredPortalPath || (
  fs.existsSync(siblingPortalPath)
    ? siblingPortalPath
    : path.join(auditRoot, 'worktrees/xrpl-dev-portal')
)
const prototype = await import(pathToFileURL(prototypeEntry).href)
const endpoint = process.env.XRPL_AUDIT_ENDPOINT || 'ws://127.0.0.1:16006'
const admin = new baseline.Client(endpoint)
const evidence = {
  timestamp: new Date().toISOString(),
  endpoint,
  image: 'rippleci/xrpld@sha256:898feb090a777fddce725b6e4af776194bbead943a02e8cc80b4b0c4556d2a52',
  node: process.version,
  scope: 'Two actual Send XRP example runs against an isolated standalone ledger. The sender has only the account reserve, so its requested 1 XRP payment cannot succeed. No public networks, production accounts, or real assets are involved. This checks one validated tec outcome, not all finality branches.',
  script: 'harness/run-local-negative-outcomes.mjs',
  results: [],
  advanceErrors: [],
}
const output = []
const originalLog = console.log
console.log = (...values) => {
  const line = values.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' ')
  output.push(line)
  originalLog(line)
}
let ticker
let advancement
function sha256(filename) {
  return crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex')
}
async function balance(client, account) {
  const response = await client.request({ command: 'account_info', account, ledger_index: 'validated' })
  return response.result.account_data.Balance
}

try {
  await admin.connect()
  const info = (await admin.request({ command: 'server_info' })).result.info
  evidence.server = { build_version: info.build_version, validated_ledger: info.validated_ledger }
  const reserveDrops = baseline.xrpToDrops(info.validated_ledger.reserve_base_xrp)
  evidence.senderFundingDrops = reserveDrops
  ticker = setInterval(() => {
    if (advancement) return
    advancement = admin.request({ command: 'ledger_accept' })
      .catch(error => { evidence.advanceErrors.push(error.message) })
      .finally(() => { advancement = undefined })
  }, 500)

  for (const [label, sdk, sampleRelative, sdkEntry] of [
    ['baseline', baseline, 'send-xrp/ts/dist/send-xrp.js', path.join(root, 'node_modules/xrpl/dist/npm/index.js')],
    ['prototype', prototype, 'devx-after/dist/send-xrp.js', prototypeEntry],
  ]) {
    const result = { label, sdk: label === 'baseline' ? 'published xrpl@5.3.0' : 'built aha DevX prototype', sdkEntry: path.relative(auditRoot, sdkEntry), sdkEntrySha256: sha256(sdkEntry), sample: sampleRelative }
    const sender = sdk.Wallet.generate()
    const client = label === 'prototype'
      ? new sdk.WalletClient(endpoint, { wallet: sender })
      : new sdk.Client(endpoint)
    const started = Date.now()
    try {
      await client.connect()
      // Public deterministic genesis credential of a standalone ledger; never logged.
      const genesis = sdk.Wallet.fromSeed('snoPBrXtMeMyMHUVTgbuqAfg1SUTb')
      const funding = await client.submitAndWait({ TransactionType: 'Payment', Account: genesis.address, Destination: sender.address, Amount: reserveDrops }, { wallet: genesis })
      assert.equal(funding.result.meta.TransactionResult, 'tesSUCCESS')
      const before = { sender: await balance(client, sender.address), receiver: await balance(client, genesis.address) }
      const originalSubmitAndWait = client.submitAndWait.bind(client)
      const originalRequest = client.request.bind(client)
      let confirmed
      let preliminaryResult
      client.request = async (...args) => {
        const response = await originalRequest(...args)
        if (args[0].command === 'submit') preliminaryResult = response.result.engine_result
        return response
      }
      client.submitAndWait = async (...args) => {
        try { confirmed = await originalSubmitAndWait(...args); return confirmed }
        catch(error) { confirmed = error.response; throw error }
      }
      const samplePath = path.join(portalRoot, '_code-samples', sampleRelative)
      result.sampleSha256 = sha256(samplePath)
      const sample = await import(pathToFileURL(samplePath).href)
      let sampleError
      try {
        if (label === 'prototype') await sample.run(client, genesis)
        else await sample.run(client, sender, genesis)
      } catch (error) {
        sampleError = error
      } finally {
        client.request = originalRequest
        client.submitAndWait = originalSubmitAndWait
      }
      assert.ok(confirmed, 'The validated failure must remain available in the response or error')
      assert.equal(confirmed.result.validated, true)
      assert.ok(confirmed.result.meta !== null && typeof confirmed.result.meta === 'object')
      assert.equal(confirmed.result.meta.TransactionResult, 'tecUNFUNDED_PAYMENT')
      assert.equal(sampleError?.message, label === 'baseline' ? 'Payment failed: tecUNFUNDED_PAYMENT' : 'Transaction failed: tecUNFUNDED_PAYMENT')
      if(label === 'prototype') assert(sampleError instanceof sdk.TransactionFailedError)
      const after = { sender: await balance(client, sender.address), receiver: await balance(client, genesis.address) }
      const fee = confirmed.result.tx_json.Fee
      assert.equal(BigInt(before.sender) - BigInt(after.sender), BigInt(fee), 'sender must lose only the transaction fee')
      assert.equal(after.receiver, before.receiver, 'receiver must receive no payment value')
      Object.assign(result, {
        passed: true,
        preliminaryResult,
        sdkResolved: label === 'baseline',
        validated: confirmed.result.validated,
        metadataKind: 'decoded object',
        finalResult: confirmed.result.meta.TransactionResult,
        transactionHash: confirmed.result.hash,
        ledgerIndex: confirmed.result.ledger_index,
        requestedAmountDrops: confirmed.result.tx_json.Amount ?? confirmed.result.tx_json.DeliverMax,
        feeDrops: fee,
        balancesDrops: { before, after },
        senderChargedOnlyFee: true,
        receiverUnchanged: true,
        exampleRejected: true,
        exampleError: sampleError.message,
      })
      console.log(`${label}: validated tecUNFUNDED_PAYMENT; failure surfaced to the actual Send XRP entrypoint; sender charged only ${fee} drops`)
    } catch (error) {
      Object.assign(result, { passed: false, error: error.stack ?? String(error) })
      console.log(`${label}: FAILED ${error.message}`)
    } finally {
      result.elapsedMs = Date.now() - started
      await client.disconnect().catch(() => {})
      evidence.results.push(result)
    }
  }
} catch (error) {
  evidence.setupError = error.stack ?? String(error)
  console.log(`Setup failed: ${error.message}`)
} finally {
  clearInterval(ticker)
  await advancement
  await admin.disconnect().catch(() => {})
  console.log = originalLog
  evidence.scriptSha256 = sha256(fileURLToPath(import.meta.url))
  evidence.passed = evidence.results.length === 2 && evidence.results.every(result => result.passed) && evidence.advanceErrors.length === 0
  fs.writeFileSync(path.join(auditRoot, 'evidence/runtime-negative-outcomes-builders.json'), JSON.stringify(evidence, null, 2) + '\n')
  fs.writeFileSync(path.join(auditRoot, 'evidence/runtime-negative-outcomes-builders.log'), output.join('\n') + '\n')
}
if (!evidence.passed) process.exitCode = 1
