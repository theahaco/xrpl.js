import { assert } from 'chai'

import {
  Batch,
  decode,
  ECDSA,
  encode,
  ValidationError,
  Wallet,
} from '../../src'
import { BatchFlags, BatchSigner } from '../../src/models/transactions/batch'
import { SponsorFlags } from '../../src/models/transactions/common'
import {
  combineBatchSigners,
  signMultiBatch,
  verifyBatchSigners,
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
        Flags: 1,
        Sequence: 215,
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
              '304502210082FE86BE1CF91682B04EF85FD13A6CF2A74C0EBD48021753821AD167DEF4D311022058C78078550C7E20F35DAC415FE03FBF7D8A610AD354BF0D87D2DD6FE29E34C1',
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
              'AA4995012BC1376C37778593B8819F240D774E0C7898799FC6BC6FD84B06F28533F5BC69EBB890CA11CE07920FA38FF08974510F17C2B0022FDE87F453977905',
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
              '7B61EE9C17BA32145EDB791180C3C825556AD00C75DD99C9B76959DEE30FB6FE6E7291DE1F96F9A2F6AD35022018798CF17268947E1E6E053A77FFB39C28630D',
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
                    '1FDE7D437581075DA61E56D0E0D7B57857BBED15016AAC36771201799D5CA35643DC19038533DB2CC89DCAE146F3372EA31D72EB5FC01F37CE4813580FAE2D07',
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
                    '190CE17CF03760B35EA5CD65EE7BCB976625F0F50A2A36BAE323CE17D554BAB97814802ACD52E2AFA3A1059B3D219BCBCBCD9C531766A7457159709033B3E004',
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

    it('signs for the Sponsor of an inner transaction', function () {
      // XLS-68: the sponsor's authorization of a sponsored inner transaction
      // is its BatchSigner entry, not a SponsorSignature.
      transaction.RawTransactions[0].RawTransaction.Sponsor =
        regkeyWallet.address
      transaction.RawTransactions[0].RawTransaction.SponsorFlags =
        SponsorFlags.spfSponsorReserve

      signMultiBatch(regkeyWallet, transaction)

      assert.strictEqual(transaction.BatchSigners?.length, 1)
      assert.strictEqual(
        transaction.BatchSigners?.[0].BatchSigner.Account,
        regkeyWallet.address,
      )
      assert.isTrue(
        verifyBatchSigners(transaction).every((result) => result.valid),
      )
    })

    it('appends a signature instead of overwriting existing BatchSigners', function () {
      signMultiBatch(edWallet, transaction)
      signMultiBatch(secpWallet, transaction)

      assert.strictEqual(transaction.BatchSigners?.length, 2)
      assert.includeMembers(
        transaction.BatchSigners?.map((signer) => signer.BatchSigner.Account) ??
          [],
        [secpWallet.address, edWallet.address],
      )
      assert.isTrue(
        verifyBatchSigners(transaction).every((result) => result.valid),
      )
    })

    it('pools multisign Signers for the same account', function () {
      signMultiBatch(regkeyWallet, transaction, {
        batchAccount: edWallet.address,
        multisign: true,
      })
      signMultiBatch(secpWallet, transaction, {
        batchAccount: edWallet.address,
        multisign: true,
      })

      assert.strictEqual(transaction.BatchSigners?.length, 1)
      const signers = transaction.BatchSigners?.[0].BatchSigner.Signers
      assert.strictEqual(signers?.length, 2)
      assert.includeMembers(
        signers?.map((signer) => signer.Signer.Account) ?? [],
        [regkeyWallet.address, secpWallet.address],
      )
      assert.isTrue(
        verifyBatchSigners(transaction).every((result) => result.valid),
      )
    })

    it('fails when signing for the Batch Account', function () {
      assert.throws(
        () => signMultiBatch(submitWallet, transaction),
        ValidationError,
        'is the Batch Account; it signs the outer transaction with Wallet.sign, not as a BatchSigner.',
      )
      assert.notProperty(transaction, 'BatchSigners')
    })

    it('fails when the Batch has not been autofilled', function () {
      delete transaction.Sequence
      transaction.RawTransactions[1].RawTransaction.Fee = undefined
      assert.throws(
        () => signMultiBatch(edWallet, transaction),
        ValidationError,
        'RawTransactions[1].RawTransaction.Fee',
      )
      assert.throws(
        () => signMultiBatch(edWallet, transaction),
        ValidationError,
        'Sequence (or TicketSequence)',
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

    it('rejects the Batch Account as a BatchSigner', function () {
      // rippled answers temBAD_SIGNER, so the combiner must not silently drop
      // such an entry: it is a signing mistake upstream.
      const badTx = {
        ...tx1,
        BatchSigners: (tx1.BatchSigners ?? []).concat({
          BatchSigner: {
            Account: originalTx.Account,
            SigningPubKey: submitWallet.publicKey,
            TxnSignature: 'DEADBEEF',
          },
        }),
      }
      assert.throws(
        () => combineBatchSigners([badTx, tx2]),
        ValidationError,
        'Batch: BatchSigners[1].BatchSigner.Account is the Batch Account; it signs the outer transaction, not as a BatchSigner.',
      )
    })

    it('merges multisign fragments for one account into one BatchSigner', function () {
      const multiTx1 = { ...originalTx }
      const multiTx2 = { ...originalTx }
      signMultiBatch(regkeyWallet, multiTx1, {
        batchAccount: edWallet.address,
        multisign: true,
      })
      signMultiBatch(secpWallet, multiTx2, {
        batchAccount: edWallet.address,
        multisign: true,
      })

      const combined = decode(combineBatchSigners([multiTx1, multiTx2]))
      const signers = combined.BatchSigners as BatchSigner[]
      assert.strictEqual(signers.length, 1)
      assert.strictEqual(signers[0].BatchSigner.Account, edWallet.address)
      assert.strictEqual(signers[0].BatchSigner.Signers?.length, 2)
      assert.isTrue(
        verifyBatchSigners(combined as unknown as Batch).every(
          (result) => result.valid,
        ),
      )
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

  describe('verifyBatchSigners', function () {
    let transaction: Batch

    beforeEach(() => {
      transaction = {
        Account: 'rJCxK2hX9tDMzbnn3cg1GU2g19Kfmhzxkp',
        Flags: BatchFlags.tfAllOrNothing,
        Sequence: 215,
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
        ],
        TransactionType: 'Batch',
      }
      signMultiBatch(edWallet, transaction)
    })

    it('accepts a valid signature', function () {
      assert.deepEqual(verifyBatchSigners(transaction), [
        { account: edWallet.address, valid: true },
      ])
      assert.deepEqual(verifyBatchSigners(encode(transaction)), [
        { account: edWallet.address, valid: true },
      ])
    })

    it('rejects a tampered TxnSignature', function () {
      const signer = (transaction.BatchSigners ?? [])[0].BatchSigner
      signer.TxnSignature = `${(signer.TxnSignature ?? '').slice(0, -2)}00`
      assert.deepEqual(verifyBatchSigners(transaction), [
        { account: edWallet.address, valid: false },
      ])
    })

    it('rejects a signature over a different inner transaction', function () {
      // Mutating an inner transaction after co-signing invalidates the
      // BatchSigners, because the signature binds the inner transaction IDs.
      transaction.RawTransactions[0].RawTransaction.Amount = '5000001'
      assert.deepEqual(verifyBatchSigners(transaction), [
        { account: edWallet.address, valid: false },
      ])
    })

    it('rejects a BatchSigner with no signature material', function () {
      transaction.BatchSigners = [
        { BatchSigner: { Account: edWallet.address } },
      ]
      assert.deepEqual(verifyBatchSigners(transaction), [
        { account: edWallet.address, valid: false },
      ])
    })

    it('returns an empty array with no BatchSigners', function () {
      delete transaction.BatchSigners
      assert.deepEqual(verifyBatchSigners(transaction), [])
    })

    it('fails with a non-Batch transaction', function () {
      assert.throws(
        // @ts-expect-error - needed for JS/codecov
        () => verifyBatchSigners(nonBatchTx),
        ValidationError,
        'TransactionType must be `Batch`.',
      )
    })
  })
})
