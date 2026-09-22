import { Client } from 'xrpl';
async function example(client: Client) {
  const response = await client.request({ command: 'account_objects', account: 'rSource', type: 'offer' });
  for (const offer of response.result.account_objects) console.log(offer.TakerGets);
}
