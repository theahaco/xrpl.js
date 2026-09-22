const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const prototype = path.resolve(process.argv[2] || (fs.existsSync(path.join(__dirname,'../worktrees/xrpl.js')) ? path.join(__dirname,'../worktrees/xrpl.js/packages/xrpl/dist/npm/index.d.ts') : path.join(__dirname,'../../packages/xrpl/dist/npm/index.d.ts')))
const cases = [
 ['Payment needs only its fields',false,`const tx = await client.tx.payment({Amount:'1',Destination:wallet.address}).signAndSubmit(); const to: string = tx.result.tx_json.Destination;`],
 ['Payment requires Amount',true,`client.tx.payment({Destination:wallet.address});`],
 ['Payment rejects field typo',true,`client.tx.payment({Amount:'1',Destination:wallet.address,DestinationTagg:12});`],
 ['Stored Payment rejects field typo',true,`const fields = {Amount:'1',Destination:wallet.address,DestinationTagg:12}; client.tx.payment(fields);`],
 ['Payment rejects another transaction discriminator',true,`client.tx.payment({Amount:'1',Destination:wallet.address,TransactionType:'OfferCreate'});`],
 ['Explicit Account is supported',false,`client.tx.payment({Account:wallet.address,Amount:'1',Destination:wallet.address});`],
 ['MPT metadata follows its builder',false,`const tx = await client.tx.mpTokenIssuanceCreate({}).signAndSubmit(); const id: string | undefined = tx.result.meta.mpt_issuance_id;`],
 ['Try result narrows using ok',false,`const result = await client.tx.payment({Amount:'1',Destination:wallet.address}).trySignAndSubmit(); if(result.ok) { const hash:string = result.response.result.hash; } else { const error:Error = result.error; }`],
 ['Try result requires narrowing',true,`const result = await client.trySubmitAndWait({TransactionType:'Payment',Account:wallet.address,Amount:'1',Destination:wallet.address}); console.log(result.response);`],
 ['accountInfo infers response',false,`const r = await client.command.accountInfo({account:wallet.address}); const sequence:number = r.result.account_data.Sequence;`],
 ['accountInfo requires account',true,`client.command.accountInfo();`],
 ['Command field typo rejected',true,`client.command.accountInfo({account:wallet.address,ledger_indx:'validated'});`],
 ['Empty command allows omission',false,`await client.command.ping();`],
 ['Ledger selector infers node',false,`const r = await client.command.ledgerEntry({mpt_issuance:'A'.repeat(48)}); const m:string|undefined=r.result.node.MPTokenMetadata;`],
 ['Binary node not exposed as JSON',true,`const r = await client.command.ledgerEntry({mpt_issuance:'A'.repeat(48),binary:true}); console.log(r.result.node.MPTokenMetadata);`],
 ['Broad binary option stays safe',true,`const r = await client.command.ledgerEntry({mpt_issuance:'A'.repeat(48),binary:Math.random()>0.5}); console.log(r.result.node.MPTokenMetadata);`],
 ['API v1 selects v1 response',false,`const r = await client.command.tx({transaction:'A'.repeat(64),api_version:1}); const account:string=r.result.Account;`],
 ['API version union stays safe',true,`const r = await client.command.tx({transaction:'A'.repeat(64),api_version:Math.random()>0.5?1:2}); const account:string=r.result.Account;`],
 ['Read-only clients have commands',false,`const reader = new Client('ws://localhost:6006'); await reader.command.ping();`],
 ['Wallet client requires wallet',true,`new WalletClient('ws://localhost:6006',{});`],
]
const prefix=`import {Client,Wallet,WalletClient} from 'xrpl'; async function run(client:WalletClient,wallet:Wallet){`
const files = new Map(cases.map((c,i)=>[path.join(__dirname,`builders-virtual-${i}.ts`),prefix+c[2]+'}']))
const completions = [
 ['All transaction factories',`client.tx./*HERE*/`,['payment','mpTokenIssuanceCreate','ammCreate'],78],
 ['All command methods',`client.command./*HERE*/`,['accountInfo','ledgerEntry','tx'],45],
 ['Payment fields',`client.tx.payment({/*HERE*/})`,['Amount','Destination','DestinationTag']],
 ['Account info fields',`client.command.accountInfo({/*HERE*/})`,['account','ledger_index']],
 ['Payment builder actions',`client.tx.payment({Amount:'1',Destination:wallet.address})./*HERE*/`,['signAndSubmit','trySignAndSubmit','toJSON']],
]
for(let i=0;i<completions.length;i++) files.set(path.join(__dirname,`builders-completion-${i}.ts`),prefix+completions[i][1]+'}')
const options={strict:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,baseUrl:__dirname,paths:{xrpl:[prototype]},typeRoots:[path.join(__dirname,'node_modules/@types')]}
const host={getScriptFileNames:()=>[...files.keys()],getScriptVersion:()=> '1',getScriptSnapshot:f=>files.has(f)?ts.ScriptSnapshot.fromString(files.get(f)):ts.sys.fileExists(f)?ts.ScriptSnapshot.fromString(ts.sys.readFile(f)):undefined,getCurrentDirectory:()=>__dirname,getCompilationSettings:()=>options,getDefaultLibFileName:o=>ts.getDefaultLibFilePath(o),fileExists:f=>files.has(f)||ts.sys.fileExists(f),readFile:f=>files.get(f)||ts.sys.readFile(f),readDirectory:ts.sys.readDirectory}
const service=ts.createLanguageService(host)
const results=cases.map((c,i)=>{const errors=service.getSemanticDiagnostics([...files.keys()][i]);return {name:c[0],passed:(errors.length>0)===c[1],diagnostics:errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n'))}})
for(let i=0;i<completions.length;i++) {
 const [name,,expected,count]=completions[i], file=path.join(__dirname,`builders-completion-${i}.ts`), source=files.get(file), pos=source.indexOf('/*HERE*/')
 const entries=service.getCompletionsAtPosition(file,pos,{})?.entries||[]
 const names=entries.map(e=>e.name)
 const docs=expected.map(name=>({name,text:ts.displayPartsToString(service.getCompletionEntryDetails(file,pos,name,{},undefined,{})?.documentation)}))
 results.push({name,passed:expected.every(k=>names.includes(k))&&(!count||names.length===count)&&docs.every(d=>d.text.length>0),count:names.length,completions:names,documentation:docs})
}
fs.writeFileSync(path.join(__dirname,'../evidence/builders-editor.json'),JSON.stringify({typescript:ts.version,scope:'Actual TypeScript language service and compiler against built declarations.',results},null,2)+'\n')
for(const r of results) console.log(`${r.passed?'PASS':'FAIL'} ${r.name}${r.passed?'':': '+r.diagnostics}`)
assert(results.every(x=>x.passed))
