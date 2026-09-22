import { Client, type LedgerEntryRequest } from 'xrpl';
async function example(client: Client, request: LedgerEntryRequest) {
  const response = await client.request(request);
  const metadata: string | undefined = response.result.node.MPTokenMetadata;
}
