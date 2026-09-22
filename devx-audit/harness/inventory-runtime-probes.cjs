const fs = require('node:fs')
const path = require('node:path')
const {Client, dropsToXrp, xrpToDrops, getBalanceChanges} = require('xrpl')

async function outcome(id, fn) {
  try { return {id, resolved: true, result: await fn()} }
  catch(error) { return {id, resolved: false, error: {name:error.name,message:error.message}} }
}
async function main() {
  const results = []
  results.push(await outcome('nft-pagination-all', async()=> {
    const client = new Client('wss://example.invalid')
    return client.requestAll({command:'account_nfts',account:'rExample'})
  }))
  results.push(await outcome('unsigned-submit-no-wallet', async()=> {
    const client = new Client('wss://example.invalid')
    return client.submit({TransactionType:'Payment',Account:'rFrom',Destination:'rTo',Amount:'1'})
  }))
  results.push(await outcome('event-on-wrong-listener', ()=> {
    const client = new Client('wss://example.invalid')
    client.on('ledgerClosed', ledger => ledger.toUpperCase())
    return client.emit('ledgerClosed', {ledger_index: 1})
  }))
  results.push(await outcome('pagination-default-multiple-pages', async()=> {
    const client = new Client('wss://example.invalid')
    let requests = 0
    // Local substitute: no connect(), no WebSocket or HTTP calls.
    client.connection.request = async () => ({
      id: ++requests,
      result: {state:[{index:String(requests)}], ...(requests === 1 ? {marker:'next'} : {})},
    })
    const pages = await client.requestAll({command:'ledger_data'})
    return {requests,pages:pages.length}
  }))
  results.push(await outcome('amount-precision-roundtrip', ()=> {
    const inputDrops = '9007199254740991'
    const xrp = dropsToXrp(inputDrops)
    return {inputDrops, xrp, outputDrops:xrpToDrops(xrp), equal:inputDrops === xrpToDrops(xrp)}
  }))
  results.push(await outcome('mpt-balance-change-coverage', ()=> {
    // Synthetic metadata isolates one public MPT balance change. It is not a
    // captured ledger transaction or a confidential-balance decryption test.
    const metadata = {
      TransactionResult:'tesSUCCESS',TransactionIndex:0,
      AffectedNodes:[{ModifiedNode:{
        LedgerEntryType:'MPToken', LedgerIndex:'0'.repeat(64),
        PreviousFields:{MPTAmount:'10'},
        FinalFields:{Account:'rExample',MPTokenIssuanceID:'0'.repeat(48),MPTAmount:'25'},
      }}],
    }
    return {inputChange:'Public MPTAmount 10 → 25',balanceChanges:getBalanceChanges(metadata)}
  }))
  const out = {baseline:require('xrpl/package.json').version, network:'No network calls. Request pagination uses a local fake connection.', results}
  fs.writeFileSync(path.resolve(__dirname,'../evidence/surface-runtime-probes.json'),JSON.stringify(out,null,2)+'\n')
  console.log(JSON.stringify(out,null,2))
}
main().catch(error=>{console.error(error);process.exitCode=1})
