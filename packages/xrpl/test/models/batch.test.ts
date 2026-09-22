import type { Batch } from '../../src'
import { BatchFlags, validateBatch } from '../../src/models/transactions/batch'
import { assertTxIsValid, assertTxValidationError } from '../testUtils'

const assertValid = (tx: any): void => assertTxIsValid(tx, validateBatch)
const assertInvalid = (tx: any, message: string): void =>
  assertTxValidationError(tx, validateBatch, message)

/**
 * Batch Transaction Verification Testing.
 *
 * Providing runtime verification testing for each specific transaction type.
 */
describe('Batch', function () {
  let tx: any

  beforeEach(function () {
    tx = {
      Account: 'rJCxK2hX9tDMzbnn3cg1GU2g19Kfmhzxkp',
      BatchSigners: [
        {
          BatchSigner: {
            Account: 'rPMh7Pi9ct699iZUTWaytJUoHcJ7cgyziK',
            SigningPubKey:
              '02691AC5AE1C4C333AE5DF8A93BDC495F0EEBFC6DB0DA7EB6EF808F3AFC006E3FE',
            TxnSignature:
              '30450221008E595499C334127A23190F61FB9ADD8B8C501D543E37945B11FABB66B097A6130220138C908E8C4929B47E994A46D611FAC17AB295CFB8D9E0828B32F2947B97394B',
          },
        },
      ],
      Flags: BatchFlags.tfAllOrNothing,
      RawTransactions: [
        {
          RawTransaction: {
            Account: 'rJCxK2hX9tDMzbnn3cg1GU2g19Kfmhzxkp',
            Amount: '5000000',
            Destination: 'rPMh7Pi9ct699iZUTWaytJUoHcJ7cgyziK',
            Fee: '0',
            Flags: 0x40000000,
            NetworkID: 21336,
            Sequence: 0,
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
            NetworkID: 21336,
            Sequence: 1,
            SigningPubKey: '',
            TransactionType: 'Payment',
          },
        },
      ],
      TransactionType: 'Batch',
    }
  })

  it('verifies valid Batch', function () {
    assertValid(tx)
  })

  it('verifies single-account Batch', function () {
    tx = {
      Account: 'rJCxK2hX9tDMzbnn3cg1GU2g19Kfmhzxkp',
      Flags: BatchFlags.tfAllOrNothing,
      RawTransactions: [
        {
          RawTransaction: {
            Account: 'rPMh7Pi9ct699iZUTWaytJUoHcJ7cgyziK',
            Amount: '5000000',
            Destination: 'rJCxK2hX9tDMzbnn3cg1GU2g19Kfmhzxkp',
            Fee: '0',
            Flags: 0x40000000,
            NetworkID: 21336,
            Sequence: 0,
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
            NetworkID: 21336,
            Sequence: 1,
            SigningPubKey: '',
            TransactionType: 'Payment',
          },
        },
      ],
      TransactionType: 'Batch',
    }
    assertValid(tx)
  })

  it('throws w/ invalid BatchSigners', function () {
    tx.BatchSigners = 0
    assertInvalid(tx, 'Batch: invalid field BatchSigners')
  })

  it('throws w/ missing RawTransactions', function () {
    delete tx.RawTransactions
    assertInvalid(tx, 'Batch: missing field RawTransactions')
  })

  it('throws w/ invalid RawTransactions', function () {
    tx.RawTransactions = 0
    assertInvalid(tx, 'Batch: invalid field RawTransactions')
  })

  it('throws w/ invalid RawTransactions object', function () {
    tx.RawTransactions = [0, tx.RawTransactions[1]]
    assertInvalid(tx, 'Batch: RawTransactions[0] is not object')
  })

  it('throws w/ invalid RawTransactions.RawTransaction object', function () {
    tx.RawTransactions = [{ RawTransaction: 0 }, tx.RawTransactions[1]]
    assertInvalid(tx, 'Batch: invalid field RawTransactions[0].RawTransaction')
  })

  it('verifies Batch with an object-form mode flag', function () {
    tx.Flags = { tfOnlyOne: true }
    assertValid(tx)
  })

  it('throws w/ no mode flag', function () {
    delete tx.Flags
    assertInvalid(
      tx,
      'Batch: exactly one of the mode flags (tfAllOrNothing, tfOnlyOne, tfUntilFailure, tfIndependent) must be set in Flags.',
    )
  })

  it('throws w/ a non-mode flag only', function () {
    tx.Flags = 1
    assertInvalid(
      tx,
      'Batch: exactly one of the mode flags (tfAllOrNothing, tfOnlyOne, tfUntilFailure, tfIndependent) must be set in Flags.',
    )
  })

  it('throws w/ two mode flags', function () {
    // eslint-disable-next-line no-bitwise -- combining two mode flags
    tx.Flags = BatchFlags.tfAllOrNothing | BatchFlags.tfIndependent
    assertInvalid(
      tx,
      'Batch: exactly one of the mode flags (tfAllOrNothing, tfOnlyOne, tfUntilFailure, tfIndependent) must be set in Flags.',
    )
  })

  it('throws w/ two object-form mode flags', function () {
    tx.Flags = { tfAllOrNothing: true, tfUntilFailure: true }
    assertInvalid(
      tx,
      'Batch: exactly one of the mode flags (tfAllOrNothing, tfOnlyOne, tfUntilFailure, tfIndependent) must be set in Flags.',
    )
  })

  it('throws w/ zero RawTransactions', function () {
    tx.RawTransactions = []
    assertInvalid(
      tx,
      'Batch: RawTransactions must contain between 2 and 8 transactions.',
    )
  })

  it('throws w/ one RawTransaction', function () {
    tx.RawTransactions = [tx.RawTransactions[0]]
    assertInvalid(
      tx,
      'Batch: RawTransactions must contain between 2 and 8 transactions.',
    )
  })

  it('throws w/ nine RawTransactions', function () {
    const inner: Record<string, unknown> = tx.RawTransactions[0]
    tx.RawTransactions = Array.from({ length: 9 }, () => ({ ...inner }))
    assertInvalid(
      tx,
      'Batch: RawTransactions must contain between 2 and 8 transactions.',
    )
  })

  it('verifies eight RawTransactions', function () {
    const inner: Record<string, unknown> = tx.RawTransactions[0]
    tx.RawTransactions = Array.from({ length: 8 }, () => ({ ...inner }))
    assertValid(tx)
  })

  it('throws w/ Delegate on the outer Batch', function () {
    tx.Delegate = 'rPMh7Pi9ct699iZUTWaytJUoHcJ7cgyziK'
    assertInvalid(
      tx,
      'Batch: Delegate is not allowed. Batch transactions cannot be delegated.',
    )
  })

  it('throws w/ nested Batch', function () {
    tx.RawTransactions = [{ RawTransaction: { ...tx } }, tx.RawTransactions[1]]
    assertInvalid(
      tx,
      'Batch: RawTransactions[0] is a Batch transaction. Cannot nest Batch transactions.',
    )
  })

  it('throws w/ non-object in BatchSigner list', function () {
    tx.BatchSigners = [1]
    assertInvalid(tx, 'Batch: BatchSigners[0] is not object.')
  })

  it('throws w/ no `tfInnerBatchTxn` flag in inner transaction', function () {
    tx.RawTransactions[0].RawTransaction.Flags = 0
    assertInvalid(
      tx,
      'Batch: RawTransactions[0] must contain the `tfInnerBatchTxn` flag.',
    )
  })

  it('types Batch.Flags and the inner transactions', function () {
    const account = 'rJCxK2hX9tDMzbnn3cg1GU2g19Kfmhzxkp'
    const inner = {
      TransactionType: 'AccountSet' as const,
      Account: account,
      Flags: 0x40000000,
    }
    const typed: Batch = {
      TransactionType: 'Batch',
      Account: account,
      Flags: { tfAllOrNothing: true },
      RawTransactions: [
        { RawTransaction: inner },
        { RawTransaction: { ...inner, Fee: '0', SigningPubKey: '' } },
      ],
    }
    const rejected: Batch = {
      ...typed,
      RawTransactions: [
        // @ts-expect-error -- a Batch cannot be nested
        { RawTransaction: typed },
        // @ts-expect-error -- an inner Fee must be '0'
        { RawTransaction: { ...inner, Fee: '12' } },
        // @ts-expect-error -- an inner cannot carry a signature
        { RawTransaction: { ...inner, TxnSignature: 'AB' } },
        // @ts-expect-error -- an inner cannot carry LastLedgerSequence
        { RawTransaction: { ...inner, LastLedgerSequence: 5 } },
      ],
    }
    assertValid(typed)
    assertInvalid(
      rejected,
      'Batch: RawTransactions[0] is a Batch transaction. Cannot nest Batch transactions.',
    )
  })
})
