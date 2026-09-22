import { Client } from 'xrpl';
async function example(client: Client) {
  const response = await client.request({ command: 'ledger_entry', mpt_issuance: 'A'.repeat(48), binary: true });
  console.log(response.result.node.MPTokenMetadata);
}
