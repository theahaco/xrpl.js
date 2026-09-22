const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const prototype = path.resolve(process.argv[2] || (fs.existsSync(path.join(__dirname,'../worktrees/xrpl.js')) ? path.join(__dirname,'../worktrees/xrpl.js/packages/xrpl/dist/npm/index.d.ts') : path.join(__dirname,'../../packages/xrpl/dist/npm/index.d.ts')))
const cases = [
  {name:'Inline Payment infers parsed metadata', reject:false, body:`const response = await client.submitAndWait({TransactionType:'Payment',Account:wallet.address,Destination:wallet.address,Amount:'1'}, {wallet}); const result: string = response.result.meta.TransactionResult;`},
  {name:'Missing required Amount is rejected', reject:true, body:`await client.submitAndWait({TransactionType:'Payment',Account:wallet.address,Destination:wallet.address}, {wallet});`},
  {name:'Optional field typo is rejected', reject:true, body:`await client.submitAndWait({TransactionType:'Payment',Account:wallet.address,Destination:wallet.address,Amount:'1',DestinationTagg:12}, {wallet});`},
  {name:'Inline account_info infers response', reject:false, body:`const response = await client.request({command:'account_info',account:wallet.address,ledger_index:'validated'}); const sequence: number = response.result.account_data.Sequence;`},
]
const files = new Map(cases.map((c,i)=>[path.join(__dirname,`getting-started-virtual-${i}.ts`),`import {Client,Wallet} from 'xrpl'; async function run(client:Client,wallet:Wallet){${c.body}}`]))
const completionFile = path.join(__dirname,'getting-started-virtual-completion.ts')
const completionSource = `import {Client,Wallet} from 'xrpl'; async function run(client:Client,wallet:Wallet){await client.submitAndWait({TransactionType:'Payment',Account:wallet.address, /*HERE*/ },{wallet});}`
files.set(completionFile,completionSource)
const options={strict:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,baseUrl:__dirname,paths:{xrpl:[prototype]},typeRoots:[path.join(__dirname,'node_modules/@types')]}
const host={getScriptFileNames:()=>[...files.keys()],getScriptVersion:()=> '1',getScriptSnapshot:f=>files.has(f)?ts.ScriptSnapshot.fromString(files.get(f)):ts.sys.fileExists(f)?ts.ScriptSnapshot.fromString(ts.sys.readFile(f)):undefined,getCurrentDirectory:()=>__dirname,getCompilationSettings:()=>options,getDefaultLibFileName:o=>ts.getDefaultLibFilePath(o),fileExists:f=>files.has(f)||ts.sys.fileExists(f),readFile:f=>files.get(f)||ts.sys.readFile(f),readDirectory:ts.sys.readDirectory}
const service=ts.createLanguageService(host)
const results=cases.map((c,i)=>{const errors=service.getSemanticDiagnostics([...files.keys()][i]);return {name:c.name,passed:(errors.length>0)===c.reject,diagnostics:errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n'))}})
const completions=service.getCompletionsAtPosition(completionFile,completionSource.indexOf('/*HERE*/'),{}).entries.map(e=>e.name)
results.push({name:'Payment discriminator guides field completion',passed:['Amount','Destination','DestinationTag'].every(k=>completions.includes(k))&&!completions.includes('TakerGets'),completions})
const out={typescript:ts.version,prototype,scope:'Actual TypeScript language-service completion and compiler checks, without transaction annotations, satisfies or casts.',results}
fs.writeFileSync(path.join(__dirname,'../evidence/getting-started-editor.json'),JSON.stringify(out,null,2)+'\n')
assert(results.every(x=>x.passed))
console.log(`${results.length}/${results.length} Getting Started checks passed`)
