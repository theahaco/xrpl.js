import { Client } from 'xrpl';
async function example(client: Client) {
  const response = await client.request({ command: 'ledger_entry', account_root: 'rSource', ledger_index: 'validated' });
  const balance: string = response.result.node.Balance;
}
