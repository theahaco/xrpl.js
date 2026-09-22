import type { Payment } from 'xrpl';
const payment = { TransactionType: 'Payment', Account: 'rSource', Destination: 'rDestination', Amount: '100', DestinationTagg: 12 } satisfies Payment;
