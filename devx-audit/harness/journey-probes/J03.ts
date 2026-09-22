import type { AccountInfoRequest } from 'xrpl';
const request = { command: 'account_info', account: 'rSource', ledger_indx: 'validated' } satisfies AccountInfoRequest;
