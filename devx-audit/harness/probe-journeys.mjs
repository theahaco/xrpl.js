import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const cases = [
  ['J01', 'A valid Payment is accepted', 'accept', null, `import type { Payment } from 'xrpl';
const payment = { TransactionType: 'Payment', Account: 'rSource', Destination: 'rDestination', Amount: '100', DestinationTag: 12 } satisfies Payment;`],
  ['J02', 'Misspelled optional transaction fields are rejected', 'reject', 7, `import type { Payment } from 'xrpl';
const payment = { TransactionType: 'Payment', Account: 'rSource', Destination: 'rDestination', Amount: '100', DestinationTagg: 12 } satisfies Payment;`],
  ['J03', 'Misspelled request fields are rejected', 'reject', 8, `import type { AccountInfoRequest } from 'xrpl';
const request = { command: 'account_info', account: 'rSource', ledger_indx: 'validated' } satisfies AccountInfoRequest;`],
  ['J04', 'Omitting Account preserves other required Payment fields', 'reject', 7, `import type { Payment } from 'xrpl';
const incomplete: Omit<Payment, 'Account'> = { TransactionType: 'Payment' };`],
  ['J05', 'Autofill exposes the Fee and LastLedgerSequence it populates', 'accept', 5, `import { Client } from 'xrpl';
async function example(client: Client) {
  const prepared = await client.autofill({ TransactionType: 'Payment', Account: 'rSource', Destination: 'rDestination', Amount: '100' });
  const fee: string = prepared.Fee;
  const expiry: number = prepared.LastLedgerSequence;
}`],
  ['J06', 'An MPT issuance lookup infers MPTokenIssuance', 'accept', 4, `import { Client } from 'xrpl';
async function example(client: Client) {
  const response = await client.request({ command: 'ledger_entry', mpt_issuance: 'A'.repeat(48), ledger_index: 'validated' });
  const metadata: string | undefined = response.result.node.MPTokenMetadata;
}`],
  ['J07', 'An account root lookup infers AccountRoot', 'accept', 4, `import { Client } from 'xrpl';
async function example(client: Client) {
  const response = await client.request({ command: 'ledger_entry', account_root: 'rSource', ledger_index: 'validated' });
  const balance: string = response.result.node.Balance;
}`],
  ['J08', 'An offer filter narrows account_objects entries', 'accept', 4, `import { Client } from 'xrpl';
async function example(client: Client) {
  const response = await client.request({ command: 'account_objects', account: 'rSource', type: 'offer' });
  for (const offer of response.result.account_objects) console.log(offer.TakerGets);
}`],
  ['J09', 'submitAndWait exposes parsed final metadata', 'accept', 5, `import { Client, Wallet } from 'xrpl';
async function example(client: Client, wallet: Wallet) {
  const response = await client.submitAndWait({ TransactionType: 'Payment', Account: wallet.address, Destination: 'rDestination', Amount: '100' }, { wallet });
  const resultCode: string = response.result.meta.TransactionResult;
}`],
  ['J10', 'Signing and submitting preserve issuance metadata type', 'accept', 5, `import { Client, Wallet } from 'xrpl';
async function example(client: Client, wallet: Wallet) {
  const prepared = await client.autofill({ TransactionType: 'MPTokenIssuanceCreate', Account: wallet.address });
  const signed = wallet.sign(prepared);
  const response = await client.submitAndWait(signed.tx_blob);
  if (response.result.meta && typeof response.result.meta !== 'string') {
    const id: string | undefined = response.result.meta.mpt_issuance_id;
  }
}`],
  ['J11', 'A literal API version selects the matching response shape', 'accept', 4, `import { Client } from 'xrpl';
async function example(client: Client) {
  const response = await client.request({ command: 'tx', transaction: 'A'.repeat(64), api_version: 1 });
  const account: string = response.result.Account;
}`],
  ['J12', 'A stored broadly typed request keeps a safe response union', 'reject', 4, `import { Client, type LedgerEntryRequest } from 'xrpl';
async function example(client: Client, request: LedgerEntryRequest) {
  const response = await client.request(request);
  const metadata: string | undefined = response.result.node.MPTokenMetadata;
}`],
  ['J13', 'A binary ledger request must not expose a JSON node', 'reject', 4, `import { Client } from 'xrpl';
async function example(client: Client) {
  const response = await client.request({ command: 'ledger_entry', mpt_issuance: 'A'.repeat(48), binary: true });
  console.log(response.result.node.MPTokenMetadata);
}`],
  ['J14', 'Known options on request literals reject typos at the call', 'reject', 8, `import { Client } from 'xrpl';
async function example(client: Client) {
  await client.request({ command: 'account_info', account: 'rSource', ledger_indx: 'validated' });
}`],
  ['J15', 'Unknown transaction fields are rejected at the submission call', 'reject', 7, `import { Client, Wallet } from 'xrpl';
async function example(client: Client, wallet: Wallet) {
  await client.submitAndWait({ TransactionType: 'Payment', Account: wallet.address, Destination: 'rDestination', Amount: '100', DestinationTagg: 12 }, { wallet });
}`],
  ['J16', 'Object flags become a numeric mask after autofill', 'accept', 5, `import { Client } from 'xrpl';
async function example(client: Client) {
  const prepared = await client.autofill({ TransactionType: 'Payment', Account: 'rSource', Destination: 'rDestination', Amount: '100', Flags: { tfPartialPayment: true } });
  const flags: number = prepared.Flags;
}`],
]

const label = process.argv[2] || 'baseline'
const declarationEntry = process.argv[3] && path.resolve(process.argv[3])
const root = path.dirname(new URL(import.meta.url).pathname)
const probeDir = path.join(root, 'journey-probes')
fs.mkdirSync(probeDir, { recursive: true })
const files = cases.map(([id, , , , code]) => {
  const file = path.join(probeDir, `${id}.ts`)
  fs.writeFileSync(file, code + '\n')
  return file
})
const options = {
  strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
  types: ['node'], typeRoots: [path.join(root, 'node_modules/@types')],
  ...(declarationEntry ? { baseUrl: root, paths: { xrpl: [declarationEntry] } } : {}),
}
const program = ts.createProgram(files, options)
const diagnostics = ts.getPreEmitDiagnostics(program)
const unrelated = diagnostics.filter(d => !d.file || !files.includes(d.file.fileName))
if (unrelated.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(unrelated, {
  getCanonicalFileName: x => x, getCurrentDirectory: () => root, getNewLine: () => '\n',
}))
const results = cases.map(([id, title, expected, issue, code], index) => {
  const errors = diagnostics.filter(d => d.file?.fileName === files[index] && d.category === ts.DiagnosticCategory.Error)
  return { id, title, criterion: expected, issue: issue ? `https://github.com/theahaco/xrpl.js/issues/${issue}` : null,
    source: code, accepted: errors.length === 0,
    satisfiesCriterion: (errors.length === 0) === (expected === 'accept'),
    diagnostics: errors.map(d => ({ code: d.code, line: d.file.getLineAndCharacterOfPosition(d.start).line + 1, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') })),
  }
})
const output = { label, compiler: ts.version, packageVersion: JSON.parse(fs.readFileSync(path.join(root, 'node_modules/xrpl/package.json'))).version,
  declarationEntry: declarationEntry || 'xrpl package declarations', options: { strict: true, skipLibCheck: true, module: 'NodeNext', target: 'ES2022' },
  note: 'This is a deliberately selected demonstration set, not a prevalence estimate or general score of SDK quality. Addresses are placeholders because these probes compile only.',
  results }
fs.writeFileSync(path.join(root, `../evidence/journey-${label}.json`), JSON.stringify(output, null, 2) + '\n')
console.log(`${label}: ${results.filter(r => r.satisfiesCriterion).length}/${results.length} selected criteria met`)
for (const r of results) console.log(`${r.id} ${r.satisfiesCriterion ? 'PASS' : 'GAP'} ${r.title}${r.diagnostics.length ? ` (${r.diagnostics.map(d => d.code).join(',')})` : ''}`)
