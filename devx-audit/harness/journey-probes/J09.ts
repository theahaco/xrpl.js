import { Client, Wallet } from 'xrpl';
async function example(client: Client, wallet: Wallet) {
  const response = await client.submitAndWait({ TransactionType: 'Payment', Account: wallet.address, Destination: 'rDestination', Amount: '100' }, { wallet });
  const resultCode: string = response.result.meta.TransactionResult;
}
