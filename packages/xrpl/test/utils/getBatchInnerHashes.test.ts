import { assert } from 'chai'

import {
  Batch,
  BatchFlags,
  getBatchInnerHashes,
  hashes,
  Payment,
} from '../../src'

const account = 'rJCxK2hX9tDMzbnn3cg1GU2g19Kfmhzxkp'
const destination = 'rPMh7Pi9ct699iZUTWaytJUoHcJ7cgyziK'

function innerPayment(sequence: number, amount: string): Payment {
  return {
    TransactionType: 'Payment',
    Account: account,
    Destination: destination,
    Amount: amount,
    Fee: '0',
    Flags: 0x40000000,
    Sequence: sequence,
    SigningPubKey: '',
  }
}

describe('getBatchInnerHashes', function () {
  it('hashes each inner transaction like hashSignedTx, in order', function () {
    const first = innerPayment(5, '1000000')
    const second = innerPayment(6, '2000000')
    const batch: Batch = {
      TransactionType: 'Batch',
      Account: account,
      Flags: BatchFlags.tfAllOrNothing,
      Sequence: 4,
      RawTransactions: [{ RawTransaction: first }, { RawTransaction: second }],
    }

    const result = getBatchInnerHashes(batch)

    assert.deepEqual(result, [
      hashes.hashSignedTx(first),
      hashes.hashSignedTx(second),
    ])
    assert.notEqual(result[0], result[1])
    assert.match(result[0], /^[0-9A-F]{64}$/u)
  })

  it('is independent of the outer transaction fields', function () {
    const inner = innerPayment(5, '1000000')
    const base: Batch = {
      TransactionType: 'Batch',
      Account: account,
      Flags: BatchFlags.tfAllOrNothing,
      Sequence: 4,
      RawTransactions: [{ RawTransaction: inner }],
    }
    const signed: Batch = {
      ...base,
      Fee: '30',
      LastLedgerSequence: 100,
      SigningPubKey:
        '02BC8C02199949B15C005B997E7C8594574E9B02BA2D0628902E0532989976CF9D',
      TxnSignature:
        '3045022100B3D311371EDAB371CD8F2B661A04B800B61D4B132E09B7B0712D3B2F11B1758302203906B44C4A150311D74FF6A35B146763C0B5B40AC30BD815113F058AA17B3E63',
    }

    assert.deepEqual(getBatchInnerHashes(signed), getBatchInnerHashes(base))
  })

  it('returns an empty array for no inner transactions', function () {
    const batch: Batch = {
      TransactionType: 'Batch',
      Account: account,
      Flags: BatchFlags.tfAllOrNothing,
      RawTransactions: [],
    }

    assert.deepEqual(getBatchInnerHashes(batch), [])
  })
})
