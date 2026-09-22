import { Client } from 'xrpl';
async function example(client: Client) {
  const response = await client.request({ command: 'ledger_entry', mpt_issuance: 'A'.repeat(48), ledger_index: 'validated' });
  const metadata: string | undefined = response.result.node.MPTokenMetadata;
}
