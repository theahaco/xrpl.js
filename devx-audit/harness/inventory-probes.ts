import { Client, Wallet, TxRequest, Payment, Transaction, decode, encode, RippledError, ConfidentialBatchOperation, xrpToDrops } from 'xrpl';
const client = new Client('wss://s.altnet.rippletest.net:51233');

async function probe_event_on_inference() {
client.on('ledgerClosed', ledger => ledger.nonexistent());
}

async function probe_event_on_wrong_listener() {
client.on('ledgerClosed', (ledger: string) => ledger.toUpperCase());
}

async function probe_event_once_inference() {
client.once('ledgerClosed', ledger => ledger.nonexistent());
}

async function probe_tx_missing_identifier() {
const requestWithoutId: TxRequest = { command: 'tx' };
}

async function probe_tx_conflicting_identifiers() {
const requestWithBothIds: TxRequest = { command: 'tx', transaction: 'hash', ctid: 'ctid' };
}

async function probe_nft_pagination_next() {
const nfts = await client.request({command: 'account_nfts', account: 'rExample'});
await client.requestNextPage({command: 'account_nfts', account: 'rExample'}, nfts);
}

async function probe_nft_pagination_all() {
const nftPages = await client.requestAll({command: 'account_nfts', account: 'rExample'});
}

async function probe_unsigned_submit_no_wallet() {
await client.submit({TransactionType: 'Payment', Account: 'rFrom', Destination: 'rTo', Amount: '1'});
}

async function probe_decode_sign_roundtrip() {
const payment: Payment = {TransactionType: 'Payment', Account: 'rFrom', Destination: 'rTo', Amount: '1'};
const decoded = decode(encode(payment));
Wallet.generate().sign(decoded);
}

async function probe_error_discovery() {
try { await client.request({command:'ping'}); } catch (error) { if (error instanceof RippledError) console.log(error.data.error); }
}

async function probe_confidential_operation_guidance() {
const badOperation: ConfidentialBatchOperation = {operation:'send', account:'rFrom', mptIssuanceID:'id', amount:1n};
}

async function probe_transaction_discriminant_guidance() {
const badPayment: Transaction = {TransactionType:'Payment', Account:'rFrom'};
}
