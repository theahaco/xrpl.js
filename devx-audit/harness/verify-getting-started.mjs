import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const root = path.dirname(fileURLToPath(import.meta.url))
const inAuditWorktree = fs.existsSync(path.join(root, '../worktrees/xrpl.js'))
const sdkRoot = inAuditWorktree ? path.join(root, '../worktrees/xrpl.js') : path.resolve(root, '../..')
const portalRoot = process.env.XRPL_PORTAL_PATH || (inAuditWorktree ? path.join(root, '../worktrees/xrpl-dev-portal') : path.resolve(root, '../../../xrpl-dev-portal'))
const { Client, WalletClient, Wallet, TransactionFailedError, xrpToDrops } = await import(pathToFileURL(path.join(sdkRoot, 'packages/xrpl/dist/npm/index.js')).href)
const { run } = await import(pathToFileURL(path.join(portalRoot, '_code-samples/get-started/ts/dist/get-acct-info.js')).href)
const endpoint = process.env.XRPL_AUDIT_ENDPOINT || 'ws://127.0.0.1:16006'
const client = new Client(endpoint)
const admin = new Client(endpoint)
const evidence = { date: new Date().toISOString(), node: process.version, endpoint, scope: 'Actual proposed Getting Started run() on an isolated standalone ledger. No public faucet or production account. Both success and validated-failure paths.', results: [] }
let ticking
let pending
try {
  await client.connect(); await admin.connect()
  const info = (await client.request({command: 'server_info'})).result.info
  evidence.server = info.build_version
  ticking = setInterval(() => { if (!pending) pending = admin.request({command:'ledger_accept'}).finally(() => {pending = undefined}) }, 500)
  // Public deterministic seed of a fresh standalone ledger; not a user credential.
  const genesis = Wallet.fromSeed('snoPBrXtMeMyMHUVTgbuqAfg1SUTb')
  async function fund(amount) {
    const wallet = Wallet.generate()
    const tx = await client.submitAndWait({TransactionType:'Payment',Account:genesis.address,Destination:wallet.address,Amount:amount},{wallet:genesis})
    assert.equal(tx.result.meta.TransactionResult,'tesSUCCESS')
    return wallet
  }
  const sender = await fund(xrpToDrops('1000'))
  const receiver = await fund(xrpToDrops('1000'))
  const signingClient = new WalletClient(endpoint, {wallet: sender})
  await signingClient.connect()
  try { await run(signingClient, receiver, 0) } finally { await signingClient.disconnect() }
  assert.equal(await client.getXrpBalance(receiver.address), 1001)
  evidence.results.push({ name: 'First payment succeeds', passed: true, receiverXrp: 1001 })
  const lowBalance = await fund(xrpToDrops(info.validated_ledger.reserve_base_xrp))
  const lowClient = new WalletClient(endpoint, {wallet: lowBalance})
  await lowClient.connect()
  let failure
  try {
    try { await run(lowClient, receiver, 0) } catch(error) { failure = error }
    assert(failure instanceof TransactionFailedError)
    assert.equal(failure.phase, 'validated')
    assert.equal(failure.response.result.meta.TransactionResult, 'tecUNFUNDED_PAYMENT')
    const outcome = await lowClient.tx.payment({Amount:xrpToDrops('1'),Destination:receiver.address}).trySignAndSubmit()
    assert.equal(outcome.ok,false)
    assert(outcome.error instanceof TransactionFailedError)
    evidence.results.push({name:'trySignAndSubmit returns a validated failure without throwing',passed:true,phase:outcome.error.phase})
  } finally { await lowClient.disconnect() }
  const fundedClient = new WalletClient(endpoint,{wallet:sender})
  await fundedClient.connect()
  try {
    const outcome = await fundedClient.tx.payment({Amount:'1',Destination:receiver.address}).trySignAndSubmit()
    assert.equal(outcome.ok,true)
    assert.equal(outcome.response.result.validated,true)
    evidence.results.push({name:'trySignAndSubmit returns a successful response',passed:true})
    const raw = await fundedClient.submitAndWait({TransactionType:'Payment',Account:sender.address,Amount:'1',Destination:receiver.address})
    assert.equal(raw.result.validated,true)
    evidence.results.push({name:'Client submission uses the bound wallet by default',passed:true})
  } finally { await fundedClient.disconnect() }
  assert.equal(await client.getXrpBalance(receiver.address), 1001.000002)
  evidence.results.push({ name:'Validated failure is reported', passed:true, message:failure.message, finalReceiverXrp:1001.000002 })
} finally {
  clearInterval(ticking)
  if (pending) await pending
  await client.disconnect(); await admin.disconnect()
  fs.writeFileSync(path.join(root,'../evidence/builders-runtime.json'), JSON.stringify(evidence,null,2)+'\n')
}
console.log(JSON.stringify(evidence,null,2))
