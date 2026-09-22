import { Client } from 'xrpl';
async function example(client: Client) {
  const prepared = await client.autofill({ TransactionType: 'Payment', Account: 'rSource', Destination: 'rDestination', Amount: '100', Flags: { tfPartialPayment: true } });
  const flags: number = prepared.Flags;
}
