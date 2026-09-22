import { assert } from 'chai'

import {
  Batch,
  BatchInnerTransaction,
  decode,
  ECDSA,
  encode,
  ValidationError,
  Wallet,
} from '../../src'
import { BatchFlags, BatchSigner } from '../../src/models/transactions/batch'
import {
  combineBatchSigners,
  signMultiBatch,
} from '../../src/Wallet/batchSigner'

// rPMh7Pi9ct699iZUTWaytJUoHcJ7cgyziK
const secpWallet = Wallet.fromSeed('spkcsko6Ag3RbCSVXV2FJ8Pd4Zac1', {
  algorithm: ECDSA.secp256k1,
})

// rJy554HmWFFJQGnRfZuoo8nV97XSMq77h7
const edWallet = Wallet.fromSeed('spkcsko6Ag3RbCSVXV2FJ8Pd4Zac1', {
  algorithm: ECDSA.ed25519,
})

// rJCxK2hX9tDMzbnn3cg1GU2g19Kfmhzxkp
const submitWallet = Wallet.fromSeed('sEd7HmQFsoyj5TAm6d98gytM9LJA1MF', {
  algorithm: ECDSA.ed25519,
})

// rwRNeznwHzdfYeKWpevYmax2NSDioyeEtT
const regkeyWallet = Wallet.fromSeed('sEdStM1pngFcLQqVfH3RQcg2Qr6ov9e', {
  algorithm: ECDSA.ed25519,
})
const otherWallet = Wallet.generate()

const nonBatchTx = {
  TransactionType: 'Payment',
  Account: 'rJy554HmWFFJQGnRfZuoo8nV97XSMq77h7',
  Destination: 'rPMh7Pi9ct699iZUTWaytJUoHcJ7cgyziK',
  Amount: '1000',
}

describe('Wallet batch operations', function () {
  describe('signMultiBatch', function () {
    let transaction: Batch

    beforeEach(() => {
      transaction = {
        Account: 'rJCxK2hX9tDMzbnn3cg1GU2g19Kfmhzxkp',
        Flags: BatchFlags.tfAllOrNothing,
        RawTransactions: [
          {
            RawTransaction: {
              Account: 'rJy554HmWFFJQGnRfZuoo8nV97XSMq77h7',
              Flags: 0x40000000,
              Amount: '5000000',
              Destination: 'rPMh7Pi9ct699iZUTWaytJUoHcJ7cgyziK',
              Fee: '0',
              Sequence: 215,
              SigningPubKey: '',
              TransactionType: 'Payment',
            },
          },
          {
            RawTransaction: {
              Account: 'rPMh7Pi9ct699iZUTWaytJUoHcJ7cgyziK',
              Flags: 0x40000000,
              Amount: '1000000',
              Destination: 'rJCxK2hX9tDMzbnn3cg1GU2g19Kfmhzxkp',
              Fee: '0',
              Sequence: 470,
              SigningPubKey: '',
              TransactionType: 'Payment',
            },
          },
        ],
        TransactionType: 'Batch',
      }
    })
    it('succeeds with secp256k1 seed', function () {
      signMultiBatch(secpWallet, transaction)
      const expected = [
        {
          BatchSigner: {
            Account: 'rPMh7Pi9ct699iZUTWaytJUoHcJ7cgyziK',
            SigningPubKey:
              '02691AC5AE1C4C333AE5DF8A93BDC495F0EEBFC6DB0DA7EB6EF808F3AFC006E3FE',
            TxnSignature:
              '3045022100AE3647A516C71EEA78C575A2DB00246F2B92D3B48064BC077670FE9F48605E1F02206361AC4270E3E2DD737F471FDFCE4EDD2D1CC2F7999808B0BE4285979012DEA4',
          },
        },
      ]
      assert.property(transaction, 'BatchSigners')
      assert.strictEqual(
        JSON.stringify(transaction.BatchSigners),
        JSON.stringify(expected),
      )
    })

    it('succeeds with ed25519 seed', function () {
      signMultiBatch(edWallet, transaction)
      const expected = [
        {
          BatchSigner: {
            Account: 'rJy554HmWFFJQGnRfZuoo8nV97XSMq77h7',
            SigningPubKey:
              'ED3CC3D14FD80C213BC92A98AFE13A405A030F845EDCFD5E395286A6E9E62BA638',
            TxnSignature:
              '83552BA9599E082E8FCFDF0AEB3026CE0DE1036BFD395AADB724DB0C3369CE9B33A307373F2DA1DBBD1132A15F5675029E7DEAA1AF0370559ECF87EC5EB64708',
          },
        },
      ]
      assert.property(transaction, 'BatchSigners')
      assert.strictEqual(
        JSON.stringify(transaction.BatchSigners),
        JSON.stringify(expected),
      )
    })

    it('succeeds with a different account', function () {
      signMultiBatch(regkeyWallet, transaction, {
        batchAccount: edWallet.address,
      })
      const expected = [
        {
          BatchSigner: {
            Account: 'rJy554HmWFFJQGnRfZuoo8nV97XSMq77h7',
            SigningPubKey:
              'ED37D3F048B7F1E680B0A97F70C7843160B9F25D6398D07E68B9A2C83AA8E1B156',
            TxnSignature:
              '8B10EE2AEF419899A72629A62CE0C742416CCDB441358CAC3377834F7379B23EB67FFA97B95FF874578C1E5E799440CDBE305F4588F6A15106E1C4BE9997280F',
          },
        },
      ]
      assert.property(transaction, 'BatchSigners')
      assert.strictEqual(
        JSON.stringify(transaction.BatchSigners),
        JSON.stringify(expected),
      )
    })

    it('succeeds with multisign', function () {
      signMultiBatch(regkeyWallet, transaction, {
        batchAccount: edWallet.address,
        multisign: true,
      })
      const expected = [
        {
          BatchSigner: {
            Account: 'rJy554HmWFFJQGnRfZuoo8nV97XSMq77h7',
            Signers: [
              {
                Signer: {
                  Account: 'rwRNeznwHzdfYeKWpevYmax2NSDioyeEtT',
                  SigningPubKey:
                    'ED37D3F048B7F1E680B0A97F70C7843160B9F25D6398D07E68B9A2C83AA8E1B156',
                  TxnSignature:
                    '6550CB4FF1F132D348D97F76783FB90BD8DE788A3792D53F85A929EC3D3E6EFFAC2246A6FACC477E1233A72ECB95BEF203860F2FBA4436C55CAA4B77953CC80B',
                },
              },
            ],
          },
        },
      ]
      assert.property(transaction, 'BatchSigners')
      assert.strictEqual(
        JSON.stringify(transaction.BatchSigners),
        JSON.stringify(expected),
      )
    })

    it('succeeds with multisign + regular key', function () {
      signMultiBatch(regkeyWallet, transaction, {
        batchAccount: edWallet.address,
        multisign: submitWallet.address,
      })
      const expected = [
        {
          BatchSigner: {
            Account: 'rJy554HmWFFJQGnRfZuoo8nV97XSMq77h7',
            Signers: [
              {
                Signer: {
                  Account: 'rJCxK2hX9tDMzbnn3cg1GU2g19Kfmhzxkp',
                  SigningPubKey:
                    'ED37D3F048B7F1E680B0A97F70C7843160B9F25D6398D07E68B9A2C83AA8E1B156',
                  TxnSignature:
                    '587775DB624191DB128F31D6FD22A19F74EB2F6954B000277FE27A076D2868A3E56DAA28F983246708E7EAD5608B38B49643839AB0203467A9859DC5861A2E04',
                },
              },
            ],
          },
        },
      ]
      assert.property(transaction, 'BatchSigners')
      assert.strictEqual(
        JSON.stringify(transaction.BatchSigners),
        JSON.stringify(expected),
      )
    })

    it('requires the delegate, not the account, to sign a delegated inner transaction', function () {
      // Delegate the first inner transaction to regkeyWallet.
      transaction.RawTransactions[0].RawTransaction.Delegate =
        regkeyWallet.address

      // The inner account holder (edWallet) is no longer a required signer.
      assert.throws(
        () => signMultiBatch(edWallet, transaction),
        ValidationError,
        'Must be signing for an address submitting a transaction in the Batch.',
      )

      // The delegate can sign on its behalf.
      signMultiBatch(regkeyWallet, transaction)
      assert.strictEqual(
        transaction.BatchSigners?.[0].BatchSigner.Account,
        regkeyWallet.address,
      )
    })

    it('fails with not-included account', function () {
      assert.throws(
        () => signMultiBatch(otherWallet, transaction),
        ValidationError,
        'Must be signing for an address submitting a transaction in the Batch.',
      )
    })

    it('fails with non-Batch transaction', function () {
      assert.throws(
        // @ts-expect-error - needed for JS/codecov
        () => signMultiBatch(edWallet, nonBatchTx),
        ValidationError,
        'Must be a Batch transaction.',
      )
    })
  })

  describe('combineBatchSigners', function () {
    let tx1: Batch
    let tx2: Batch
    const originalTx: Batch = {
      Account: 'rJCxK2hX9tDMzbnn3cg1GU2g19Kfmhzxkp',
      Flags: BatchFlags.tfAllOrNothing,
      LastLedgerSequence: 14973,
      NetworkID: 21336,
      RawTransactions: [
        {
          RawTransaction: {
            Account: 'rJy554HmWFFJQGnRfZuoo8nV97XSMq77h7',
            Amount: '5000000',
            Destination: 'rPMh7Pi9ct699iZUTWaytJUoHcJ7cgyziK',
            Fee: '0',
            Flags: 0x40000000,
            Sequence: 215,
            SigningPubKey: '',
            TransactionType: 'Payment',
          },
        },
        {
          RawTransaction: {
            Account: 'rPMh7Pi9ct699iZUTWaytJUoHcJ7cgyziK',
            Amount: '1000000',
            Destination: 'rJCxK2hX9tDMzbnn3cg1GU2g19Kfmhzxkp',
            Fee: '0',
            Flags: 0x40000000,
            Sequence: 470,
            SigningPubKey: '',
            TransactionType: 'Payment',
          },
        },
      ],
      Sequence: 215,
      TransactionType: 'Batch',
    }
    let expectedValid: BatchSigner[]

    beforeEach(() => {
      tx1 = { ...originalTx }
      tx2 = { ...originalTx }
      signMultiBatch(edWallet, tx1)
      signMultiBatch(secpWallet, tx2)
      expectedValid = (tx1.BatchSigners ?? []).concat(tx2.BatchSigners ?? [])
    })

    it('combines valid transactions', function () {
      const result = combineBatchSigners([tx1, tx2])
      assert.deepEqual(decode(result).BatchSigners, expectedValid)
    })

    it('combines valid serialized transactions', function () {
      const result = combineBatchSigners([encode(tx1), encode(tx2)])
      assert.deepEqual(decode(result).BatchSigners, expectedValid)
    })

    it('sorts the signers', function () {
      const result = combineBatchSigners([tx2, tx1])
      assert.deepEqual(decode(result).BatchSigners, expectedValid)
    })

    it('removes signer for Batch submitter', function () {
      // add a third inner transaction from the transaction submitter
      const rawTx3: { RawTransaction: BatchInnerTransaction } = {
        RawTransaction: {
          Account: 'rJCxK2hX9tDMzbnn3cg1GU2g19Kfmhzxkp',
          Amount: '1000000',
          Destination: 'rPMh7Pi9ct699iZUTWaytJUoHcJ7cgyziK',
          Fee: '0',
          Flags: 0x40000000,
          Sequence: 470,
          SigningPubKey: '',
          TransactionType: 'Payment',
        },
      }
      const rawTxs = originalTx.RawTransactions.concat(rawTx3)

      // set up all the transactions again (repeat what's done in `beforeEach`)
      const newTx = {
        ...originalTx,
        RawTransactions: rawTxs,
      }
      tx1 = { ...newTx }
      tx2 = { ...newTx }
      const tx3 = { ...newTx }
      signMultiBatch(edWallet, tx1)
      signMultiBatch(secpWallet, tx2)
      signMultiBatch(submitWallet, tx3)

      // run test
      const result = combineBatchSigners([tx1, tx2, tx3])
      const expected = (tx1.BatchSigners ?? []).concat(tx2.BatchSigners ?? [])
      assert.deepEqual(decode(result).BatchSigners, expected)
    })

    it('fails with no transactions provided', function () {
      assert.throws(
        () => combineBatchSigners([]),
        ValidationError,
        'There are 0 transactions to combine.',
      )
    })

    it('fails with non-Batch transaction provided', function () {
      assert.throws(
        // @ts-expect-error - needed for JS/codecov
        () => combineBatchSigners([tx1, tx2, nonBatchTx]),
        ValidationError,
        'TransactionType must be `Batch`.',
      )
    })

    it('fails with no BatchSigners provided in a transaction', function () {
      const badTx1 = { ...tx1 }
      delete badTx1.BatchSigners
      assert.throws(
        () => combineBatchSigners([badTx1, tx2]),
        ValidationError,
        'For combining Batch transaction signatures, all transactions must include a BatchSigners field containing an array of signatures.',
      )

      badTx1.BatchSigners = []
      assert.throws(
        () => combineBatchSigners([badTx1, tx2]),
        ValidationError,
        'For combining Batch transaction signatures, all transactions must include a BatchSigners field containing an array of signatures.',
      )
    })

    it('fails with signed inner transaction', function () {
      assert.throws(
        () => combineBatchSigners([secpWallet.sign(tx1).tx_blob, tx2]),
        ValidationError,
        'Batch transaction must be unsigned.',
      )
    })

    it('fails with different flags signed', function () {
      const badTx2 = { ...tx2 }
      badTx2.Flags = BatchFlags.tfIndependent
      signMultiBatch(secpWallet, tx2)
      assert.throws(
        () => combineBatchSigners([tx1, badTx2]),
        ValidationError,
        'Account, sequence, flags, and transaction hashes must be the same for all provided transactions.',
      )
    })

    it('fails with different outer Account signed', function () {
      const badTx2 = { ...tx2, Account: 'rJy554HmWFFJQGnRfZuoo8nV97XSMq77h7' }
      assert.throws(
        () => combineBatchSigners([tx1, badTx2]),
        ValidationError,
        'Account, sequence, flags, and transaction hashes must be the same for all provided transactions.',
      )
    })

    it('fails with different Sequence signed', function () {
      const badTx2 = { ...tx2, Sequence: 216 }
      assert.throws(
        () => combineBatchSigners([tx1, badTx2]),
        ValidationError,
        'Account, sequence, flags, and transaction hashes must be the same for all provided transactions.',
      )
    })
  })
})
