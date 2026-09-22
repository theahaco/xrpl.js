import { Client } from 'xrpl';
async function example(client: Client) {
  await client.request({ command: 'account_info', account: 'rSource', ledger_indx: 'validated' });
}
