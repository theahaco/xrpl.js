import type { Payment } from 'xrpl';
const incomplete: Omit<Payment, 'Account'> = { TransactionType: 'Payment' };
