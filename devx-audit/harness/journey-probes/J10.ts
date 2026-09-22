import { Client, Wallet } from 'xrpl';
async function example(client: Client, wallet: Wallet) {
  const prepared = await client.autofill({ TransactionType: 'MPTokenIssuanceCreate', Account: wallet.address });
  const signed = wallet.sign(prepared);
  const response = await client.submitAndWait(signed.tx_blob);
  if (response.result.meta && typeof response.result.meta !== 'string') {
    const id: string | undefined = response.result.meta.mpt_issuance_id;
  }
}
