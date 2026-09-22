import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.dirname(new URL(import.meta.url).pathname)
const sdk = process.argv[2] ? await import(pathToFileURL(path.resolve(process.argv[2])).href) : await import('xrpl')
const { Client, Wallet } = sdk
const label = process.argv[3] || 'baseline'
const useAfter = process.argv[4] === 'after'
const endpoint = process.env.XRPL_AUDIT_ENDPOINT || 'ws://127.0.0.1:16006'
const portalRoot = process.env.XRPL_PORTAL_PATH || (fs.existsSync(path.join(root, '../worktrees/xrpl-dev-portal')) ? path.join(root, '../worktrees/xrpl-dev-portal') : path.resolve(root, '../../../xrpl-dev-portal'))
const client = new Client(endpoint)
const admin = new Client(endpoint)
const entries = [
  ['Get Started TypeScript', 'devx-before/get-started/dist/get-acct-info.js', 2],
  ['Send XRP TypeScript', 'send-xrp/ts/dist/send-xrp.js', 2],
  ['MPT metadata TypeScript', 'issue-mpt-with-metadata/ts/dist/issue-mpt-with-metadata.js', 1],
  ['Guided Create AMM TypeScript', 'create-amm/ts/dist/create-amm-guided.js', 2],
]
const results = []
let ticker
let info
let advancing = false
let advanceErrors = []
const originalLog = console.log
const output = []
console.log = (...values) => {
  const text = values.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(' ')
  output.push(text)
  originalLog(...values)
}
try {
  await client.connect()
  await admin.connect()
  info = (await client.request({ command: 'server_info' })).result.info
  ticker = setInterval(async () => {
    if (advancing) return
    advancing = true
    try { await admin.request({ command: 'ledger_accept' }) }
    catch (error) { advanceErrors.push(error.message) }
    finally { advancing = false }
  }, 500)
  // Public, deterministic genesis seed of a fresh standalone ledger. Not a user credential.
  const genesis = Wallet.fromSeed('snoPBrXtMeMyMHUVTgbuqAfg1SUTb')
  for (const [name, relative, count] of entries) {
    const start = Date.now()
    const logStart = output.length
    try {
      const wallets = []
      for (let i = 0; i < count; i++) {
        const wallet = Wallet.generate()
        const funded = await client.submitAndWait({ TransactionType: 'Payment', Account: genesis.address, Destination: wallet.address, Amount: '1000000000' }, { wallet: genesis })
        if (funded.result.meta?.TransactionResult !== 'tesSUCCESS') throw new Error('Local account funding failed')
        wallets.push(wallet)
      }
      const afterFiles = { 'Get Started TypeScript': 'get-started.js', 'Send XRP TypeScript': 'send-xrp.js', 'MPT metadata TypeScript': 'issue-mpt-with-metadata.js', 'Guided Create AMM TypeScript': 'create-amm.js' }
      const samplePath = useAfter ? `devx-after/dist/${afterFiles[name]}` : relative
      const modulePath = path.join(portalRoot, '_code-samples', samplePath)
      const example = await import(pathToFileURL(modulePath).href)
      if (useAfter) {
        const signerCount = name === 'Guided Create AMM TypeScript' ? 2 : 1
        const signingClients = wallets.slice(0, signerCount).map(wallet => new sdk.WalletClient(endpoint, { wallet }))
        try {
          for (const signingClient of signingClients) await signingClient.connect()
          if (name.startsWith('Get Started')) await example.run(signingClients[0], wallets[1], 0)
          else if (name.startsWith('Send XRP')) await example.run(signingClients[0], wallets[1])
          else await example.run(...signingClients)
        } finally {
          await Promise.all(signingClients.map(signingClient => signingClient.disconnect()))
        }
      } else if (name.startsWith('Get Started')) await example.run(client, wallets[0], wallets[1], 0)
      else await example.run(client, ...wallets)
      results.push({ name, path: samplePath, passed: true, elapsedMs: Date.now() - start, output: output.slice(logStart) })
    } catch (error) {
      results.push({ name, path: relative, passed: false, error: error.stack || String(error), elapsedMs: Date.now() - start, output: output.slice(logStart) })
      originalLog(`${name}: FAILED ${error.message}`)
    }
  }
} finally {
  clearInterval(ticker)
  await client.disconnect().catch(() => {})
  await admin.disconnect().catch(() => {})
  console.log = originalLog
  const result = {
    label, endpoint, server: { build_version: info?.build_version, network_id: info?.network_id, validated_ledger: info?.validated_ledger },
    image: 'rippleci/xrpld@sha256:898feb090a777fddce725b6e4af776194bbead943a02e8cc80b4b0c4556d2a52',
    node: process.version,
    scope: 'Real transactions on isolated standalone ledger. No production accounts, assets, or public faucet. This does not validate public network amendment availability or every branch of the samples.',
    sdk: process.argv[2] || 'published xrpl@5.3.0', results, advanceErrors,
  }
  fs.writeFileSync(path.join(root, `../evidence/runtime-${label}.json`), JSON.stringify(result, null, 2) + '\n')
}
console.log(`${results.filter(r => r.passed).length}/${entries.length} example workflows completed`)
if (results.length !== entries.length || results.some(r => !r.passed)) process.exitCode = 1
