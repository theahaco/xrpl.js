import { Client } from 'xrpl';
async function example(client: Client) {
  const response = await client.request({ command: 'tx', transaction: 'A'.repeat(64), api_version: 1 });
  const account: string = response.result.Account;
}
