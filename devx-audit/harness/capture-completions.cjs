const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')
const ts = require(process.env.XRPL_TYPESCRIPT_PATH || 'typescript')
const sdk = path.resolve(__dirname, '../../packages/xrpl/dist/npm/index.d.ts')
const output = path.resolve(__dirname, '../evidence/editor-completions')
const prefix = `import { Wallet, WalletClient, xrpToDrops } from 'xrpl'\n\nconst wallet = Wallet.generate()\nconst recipient = Wallet.generate()\nconst server = 'wss://s.altnet.rippletest.net:51233'\nconst client = new WalletClient(server, { wallet })\n\n`
const cases = [
  { id: 'transactions', title: 'Discover transactions with client.tx', subtitle: 'Choose a transaction; its builder supplies the kind and signing account.', code: 'client.tx./*HERE*/', selected: 'payment', count: 78 },
  { id: 'commands', title: 'Discover requests with client.command', subtitle: 'Choose a named command and follow its documented inputs.', code: 'client.command./*HERE*/', selected: 'accountInfo', count: 45 },
  { id: 'payment-fields', title: 'Let the payment fields guide you', subtitle: 'Completion exposes the required fields and their inline documentation.', code: 'client.tx.payment({\n  /*HERE*/\n})', selected: 'Amount', required: ['Amount', 'Destination', 'DestinationTag'] },
  { id: 'builder-actions', title: 'Discover how to submit the draft', subtitle: 'Sign and await success, handle an explicit outcome, or inspect the draft.', code: "client.tx.payment({\n  Amount: xrpToDrops('1'),\n  Destination: recipient.address\n})./*HERE*/", selected: 'signAndSubmit', required: ['signAndSubmit', 'trySignAndSubmit', 'toJSON'], count: 3 },
]
const files = new Map(cases.map(c => [path.join(__dirname, `completion-preview-${c.id}.ts`), prefix + c.code]))
const options = { strict: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, baseUrl: __dirname, paths: { xrpl: [sdk] }, typeRoots: [path.join(__dirname, 'node_modules/@types')] }
const host = {
  getScriptFileNames: () => [...files.keys()], getScriptVersion: () => '1',
  getScriptSnapshot: f => files.has(f) ? ts.ScriptSnapshot.fromString(files.get(f)) : ts.sys.fileExists(f) ? ts.ScriptSnapshot.fromString(ts.sys.readFile(f)) : undefined,
  getCurrentDirectory: () => __dirname, getCompilationSettings: () => options,
  getDefaultLibFileName: o => ts.getDefaultLibFilePath(o), fileExists: f => files.has(f) || ts.sys.fileExists(f),
  readFile: f => files.get(f) || ts.sys.readFile(f), readDirectory: ts.sys.readDirectory,
}
const service = ts.createLanguageService(host)
const results = cases.map(c => {
  const file = path.join(__dirname, `completion-preview-${c.id}.ts`)
  const source = files.get(file)
  const position = source.indexOf('/*HERE*/')
  const entries = service.getCompletionsAtPosition(file, position, {})?.entries || []
  assert(entries.some(e => e.name === c.selected), `Missing ${c.selected}`)
  if (c.count) assert.equal(entries.length, c.count, `${c.id}: count changed`)
  for (const name of c.required || []) assert(entries.some(e => e.name === name))
  const details = service.getCompletionEntryDetails(file, position, c.selected, {}, undefined, {})
  const documentation = ts.displayPartsToString(details.documentation)
  assert(documentation, `${c.id}: missing inline documentation`)
  return { ...c, source: source.replace('/*HERE*/', ''), cursorOffset: position,
    entries: entries.map(e => ({ name: e.name, kind: e.kind, modifiers: e.kindModifiers })),
    selectedDetails: { signature: ts.displayPartsToString(details.displayParts), documentation } }
})
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'completions.json'), JSON.stringify({
  source: 'Actual TypeScript language-service completions against the built aha SDK. Images are rendered previews, not editor screenshots.',
  typescript: ts.version, sdkRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8' }).trim(),
  declarationSha256: crypto.createHash('sha256').update(fs.readFileSync(sdk)).digest('hex'), results,
}, null, 2) + '\n')
for (const c of results) console.log(`${c.id}: ${c.entries.length} completions; ${c.selected}\n${c.selectedDetails.documentation}\n${c.selectedDetails.signature.slice(0, 180)}\n`)
