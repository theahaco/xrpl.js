import { Client, Wallet } from 'xrpl';
async function example(client: Client, wallet: Wallet) {
  await client.submitAndWait({ TransactionType: 'Payment', Account: wallet.address, Destination: 'rDestination', Amount: '100', DestinationTagg: 12 }, { wallet });
}
