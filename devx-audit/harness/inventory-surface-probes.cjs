const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const cases = [
  {id:'event-on-inference', intent:'An unknown ledgerClosed payload field should fail type checking.', code:`client.on('ledgerClosed', ledger => ledger.nonexistent());`},
  {id:'event-on-wrong-listener', intent:'A string callback for ledgerClosed should fail type checking.', code:`client.on('ledgerClosed', (ledger: string) => ledger.toUpperCase());`},
  {id:'event-once-inference', intent:'Inherited once should retain typed payloads.', code:`client.once('ledgerClosed', ledger => ledger.nonexistent());`},
  {id:'tx-missing-identifier', intent:'A tx query requires a transaction hash or CTID.', code:`const requestWithoutId: TxRequest = { command: 'tx' };`},
  {id:'tx-conflicting-identifiers', intent:'A tx query requires exactly one identifier.', code:`const requestWithBothIds: TxRequest = { command: 'tx', transaction: 'hash', ctid: 'ctid' };`},
  {id:'nft-pagination-next', intent:'An account_nfts response should work with the next-page helper.', code:`const nfts = await client.request({command: 'account_nfts', account: 'rExample'});\nawait client.requestNextPage({command: 'account_nfts', account: 'rExample'}, nfts);`},
  {id:'nft-pagination-all', intent:'An accepted account_nfts request should work with requestAll defaults.', code:`const nftPages = await client.requestAll({command: 'account_nfts', account: 'rExample'});`},
  {id:'unsigned-submit-no-wallet', intent:'An unsigned JSON transaction cannot be submitted without a wallet.', code:`await client.submit({TransactionType: 'Payment', Account: 'rFrom', Destination: 'rTo', Amount: '1'});`},
  {id:'decode-sign-roundtrip', intent:'Decoding a known valid encoded payment should retain useful transaction information.', code:`const payment: Payment = {TransactionType: 'Payment', Account: 'rFrom', Destination: 'rTo', Amount: '1'};\nconst decoded = decode(encode(payment));\nWallet.generate().sign(decoded);`},
  {id:'error-discovery', intent:'Narrowing an RPC error to RippledError should expose the RPC error code.', code:`try { await client.request({command:'ping'}); } catch (error) { if (error instanceof RippledError) console.log(error.data.error); }`},
  {id:'confidential-operation-guidance', intent:'A confidential send recipe must include destination and sender keypair.', code:`const badOperation: ConfidentialBatchOperation = {operation:'send', account:'rFrom', mptIssuanceID:'id', amount:1n};`},
  {id:'transaction-discriminant-guidance', intent:'Selecting Payment should require destination and amount.', code:`const badPayment: Transaction = {TransactionType:'Payment', Account:'rFrom'};`},
]
const file = path.join(__dirname, 'inventory-probes.ts')
let content = `import { Client, Wallet, TxRequest, Payment, Transaction, decode, encode, RippledError, ConfidentialBatchOperation, xrpToDrops } from 'xrpl';\nconst client = new Client('wss://s.altnet.rippletest.net:51233');\n`
for (const item of cases) {
  content += `\nasync function probe_${item.id.replaceAll('-','_')}() {\n`
  item.startLine = content.split('\n').length
  content += item.code + '\n'
  item.endLine = content.split('\n').length - 1
  content += '}\n'
}
fs.writeFileSync(file, content)
const options = {strict:true, skipLibCheck:true, target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.NodeNext, moduleResolution:ts.ModuleResolutionKind.NodeNext, noEmit:true}
const candidate = process.argv[2]
const outputLabel = process.argv[3] || (candidate ? 'prototype' : '')
if (candidate) {
  options.baseUrl = __dirname
  options.paths = { xrpl: [path.resolve(candidate)] }
}
const program = ts.createProgram([file],options)
const diagnostics = ts.getPreEmitDiagnostics(program)
const results = cases.map(item => ({
  ...item,
  diagnostics: diagnostics.filter(d => d.file?.fileName === file).map(d => ({code:d.code, line:d.file.getLineAndCharacterOfPosition(d.start).line+1, message:ts.flattenDiagnosticMessageText(d.messageText,'\n')})).filter(d => d.line >= item.startLine && d.line <= item.endLine),
}))
const host = {
  getScriptFileNames:() => [file],
  getScriptVersion:() => '1',
  getScriptSnapshot:name => ts.sys.fileExists(name) ? ts.ScriptSnapshot.fromString(ts.sys.readFile(name)) : undefined,
  getCurrentDirectory:() => __dirname,
  getCompilationSettings:() => options,
  getDefaultLibFileName:opts => ts.getDefaultLibFilePath(opts),
  fileExists:ts.sys.fileExists, readFile:ts.sys.readFile, readDirectory:ts.sys.readDirectory,
  directoryExists:ts.sys.directoryExists, getDirectories:ts.sys.getDirectories,
}
const service = ts.createLanguageService(host)
const queries = [
  ['Client constructor', content.indexOf('new Client') + 4],
  ['Client.on', content.indexOf('client.on') + 7],
  ['Client.request', content.indexOf('client.request(') + 8],
  ['Wallet.generate', content.indexOf('Wallet.generate') + 8],
  ['xrpToDrops', content.indexOf('xrpToDrops') + 2],
]
const hover = queries.map(([label,pos]) => {
  const info = service.getQuickInfoAtPosition(file,pos)
  return {label, found:Boolean(info), display:ts.displayPartsToString(info?.displayParts || []), documentation:ts.displayPartsToString(info?.documentation || []), tags:info?.tags || []}
})
const checker = program.getTypeChecker()
const inferred = []
function visit(node) {
  if (ts.isParameter(node) && node.name.getText() === 'ledger') inferred.push({line:node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line+1, name:node.name.getText(), type:checker.typeToString(checker.getTypeAtLocation(node))})
  ts.forEachChild(node,visit)
}
visit(program.getSourceFile(file))
const out = {baseline:{xrpl:require('xrpl/package.json').version,typescript:ts.version}, options, probes:results, quickInfo:hover, inferred, unrelatedDiagnostics:diagnostics.filter(d=>d.file?.fileName!==file).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n'))}
out.packageUnderTest = candidate ? path.resolve(candidate) : 'published xrpl@5.3.0'
fs.writeFileSync(path.resolve(__dirname,`../evidence/surface-probes${outputLabel ? '-' + outputLabel : ''}.json`),JSON.stringify(out,null,2)+'\n')
console.log(JSON.stringify({ quickInfo: hover.map(({label,documentation}) => ({ label, documentationCharacters:documentation.length })), unrelatedDiagnostics:out.unrelatedDiagnostics },null,2))
