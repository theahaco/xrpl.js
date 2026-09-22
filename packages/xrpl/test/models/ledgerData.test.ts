import { assert } from 'chai'

import type {
  LedgerDataLabeledLedgerEntry,
  LedgerDataLedgerState,
} from '../../src'

/**
 * Response-shape checks for `ledger_data`. A JSON state entry is the raw
 * ledger object plus `index`; rippled never emits a lowercase
 * `ledgerEntryType` label.
 */
describe('ledger_data response shape', function () {
  const accountRoot: LedgerDataLabeledLedgerEntry = {
    LedgerEntryType: 'AccountRoot',
    Account: 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH',
    Balance: '1000000',
    Flags: 0,
    OwnerCount: 0,
    PreviousTxnID:
      'F9A1BD8E4C5E2A9A1F7E2B4D5C6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A',
    PreviousTxnLgrSeq: 3,
    Sequence: 4,
    index: 'A8B0E1F26ACD4D5E4D2F6D2A1E76F9C3CB28D8F8D8E1E8B3D1B6E0A6B7C8D9E0',
  }

  it('JSON state entries are plain ledger entries', function () {
    assert.notProperty(accountRoot, 'ledgerEntryType')
    assert.equal(accountRoot.LedgerEntryType, 'AccountRoot')
  })

  it('state entries discriminate on data vs LedgerEntryType', function () {
    const state: LedgerDataLedgerState[] = [
      accountRoot,
      {
        data: '1100612200000000',
        index:
          'B9C1F2E37BDE5E6F5E3A7E3B2F87A0D4DC39E9A9E9F2F9C4E2C7F1B7C8D9E0F1',
      },
    ]

    const labels = state.map((entry) => {
      if ('data' in entry) {
        return 'binary'
      }
      return entry.LedgerEntryType
    })
    assert.deepEqual(labels, ['AccountRoot', 'binary'])
  })
})
