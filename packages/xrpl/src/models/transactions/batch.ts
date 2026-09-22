import { ValidationError } from '../../errors'
import { Signer } from '../common'
import { hasFlag } from '../utils'

import {
  BaseTransaction,
  GlobalFlags,
  GlobalFlagsInterface,
  isArray,
  isNull,
  isRecord,
  isString,
  isValue,
  validateBaseTransaction,
  validateOptionalField,
  validateRequiredField,
} from './common'
import type { SubmittableTransaction } from './transaction'

/**
 * Enum representing values of {@link Batch} transaction flags.
 *
 * @category Transaction Flags
 */
export enum BatchFlags {
  tfAllOrNothing = 0x00010000,
  tfOnlyOne = 0x00020000,
  tfUntilFailure = 0x00040000,
  tfIndependent = 0x00080000,
}

/**
 * Map of flags to boolean values representing {@link Batch} transaction
 * flags.
 *
 * @category Transaction Flags
 */
export interface BatchFlagsInterface extends GlobalFlagsInterface {
  tfAllOrNothing?: boolean
  tfOnlyOne?: boolean
  tfUntilFailure?: boolean
  tfIndependent?: boolean
}

export interface BatchSigner {
  BatchSigner: {
    Account: string

    SigningPubKey?: string

    TxnSignature?: string

    Signers?: Signer[]
  }
}

/**
 * A transaction wrapped inside a {@link Batch}. Mirrors rippled's inner-transaction
 * rules: a Batch cannot be nested, the inner `Fee` must be `'0'`, `SigningPubKey` must
 * be empty, and the inner carries no signature, `Signers`, or `LastLedgerSequence`
 * (the outer Batch is what gets signed and expires). Inner transactions must also set
 * the `tfInnerBatchTxn` flag, which `validate` checks at runtime.
 *
 * @category Transaction Models
 */
export type BatchInnerTransaction = Exclude<SubmittableTransaction, Batch> & {
  Fee?: '0'
  SigningPubKey?: ''
  TxnSignature?: never
  Signers?: never
  LastLedgerSequence?: never
}

/**
 * Minimum number of inner transactions rippled accepts in a Batch.
 */
const MIN_RAW_TRANSACTIONS = 2

/**
 * Maximum number of inner transactions rippled accepts in a Batch.
 */
const MAX_RAW_TRANSACTIONS = 8

/**
 * The mutually exclusive Batch mode flags; rippled requires exactly one.
 */
const BATCH_MODE_FLAGS: ReadonlyArray<[keyof typeof BatchFlags, BatchFlags]> = [
  ['tfAllOrNothing', BatchFlags.tfAllOrNothing],
  ['tfOnlyOne', BatchFlags.tfOnlyOne],
  ['tfUntilFailure', BatchFlags.tfUntilFailure],
  ['tfIndependent', BatchFlags.tfIndependent],
]

/**
 * @category Transaction Models
 */
export interface Batch extends BaseTransaction {
  TransactionType: 'Batch'

  /**
   * Exactly one of the {@link BatchFlags} mode flags (`tfAllOrNothing`,
   * `tfOnlyOne`, `tfUntilFailure`, `tfIndependent`) must be set.
   */
  Flags?: number | BatchFlagsInterface

  BatchSigners?: BatchSigner[]

  /**
   * Between 2 and 8 inner transactions.
   */
  RawTransactions: Array<{
    RawTransaction: BatchInnerTransaction
  }>
}

function validateBatchInnerTransaction(
  tx: Record<string, unknown>,
  index: number,
): void {
  if (tx.TransactionType === 'Batch') {
    throw new ValidationError(
      `Batch: RawTransactions[${index}] is a Batch transaction. Cannot nest Batch transactions.`,
    )
  }

  // Check for the `tfInnerBatchTxn` flag in the inner transactions
  if (!hasFlag(tx, GlobalFlags.tfInnerBatchTxn, 'tfInnerBatchTxn')) {
    throw new ValidationError(
      `Batch: RawTransactions[${index}] must contain the \`tfInnerBatchTxn\` flag.`,
    )
  }
  validateOptionalField(tx, 'Fee', isValue('0'), {
    paramName: `RawTransactions[${index}].RawTransaction.Fee`,
    txType: 'Batch',
  })
  validateOptionalField(tx, 'SigningPubKey', isValue(''), {
    paramName: `RawTransactions[${index}].RawTransaction.SigningPubKey`,
    txType: 'Batch',
  })
  validateOptionalField(tx, 'TxnSignature', isNull, {
    paramName: `RawTransactions[${index}].RawTransaction.TxnSignature`,
    txType: 'Batch',
  })
  validateOptionalField(tx, 'Signers', isNull, {
    paramName: `RawTransactions[${index}].RawTransaction.Signers`,
    txType: 'Batch',
  })
  validateOptionalField(tx, 'LastLedgerSequence', isNull, {
    paramName: `RawTransactions[${index}].RawTransaction.LastLedgerSequence`,
    txType: 'Batch',
  })
}

/**
 * Verify the form and type of a Batch at runtime.
 *
 * @param tx - A Batch Transaction.
 * @throws When the Batch is malformed.
 */
// eslint-disable-next-line max-lines-per-function -- needed here due to the complexity
export function validateBatch(tx: Record<string, unknown>): void {
  validateBaseTransaction(tx)

  const modeFlagCount = BATCH_MODE_FLAGS.filter(([name, value]) =>
    hasFlag(tx, value, name),
  ).length
  if (modeFlagCount !== 1) {
    throw new ValidationError(
      'Batch: exactly one of the mode flags (tfAllOrNothing, tfOnlyOne, tfUntilFailure, tfIndependent) must be set in Flags.',
    )
  }

  if (tx.Delegate != null) {
    throw new ValidationError(
      'Batch: Delegate is not allowed. Batch transactions cannot be delegated.',
    )
  }

  validateRequiredField(tx, 'RawTransactions', isArray)

  if (
    tx.RawTransactions.length < MIN_RAW_TRANSACTIONS ||
    tx.RawTransactions.length > MAX_RAW_TRANSACTIONS
  ) {
    throw new ValidationError(
      `Batch: RawTransactions must contain between ${MIN_RAW_TRANSACTIONS} and ${MAX_RAW_TRANSACTIONS} transactions.`,
    )
  }

  tx.RawTransactions.forEach((rawTxObj, index) => {
    if (!isRecord(rawTxObj)) {
      throw new ValidationError(
        `Batch: RawTransactions[${index}] is not object.`,
      )
    }
    validateRequiredField(rawTxObj, 'RawTransaction', isRecord, {
      paramName: `RawTransactions[${index}].RawTransaction`,
      txType: 'Batch',
    })

    const rawTx = rawTxObj.RawTransaction
    validateBatchInnerTransaction(rawTx, index)

    // Full validation of each `RawTransaction` object is done in `validate` to avoid dependency cycles
  })

  validateOptionalField(tx, 'BatchSigners', isArray)

  tx.BatchSigners?.forEach((signerObj, index) => {
    if (!isRecord(signerObj)) {
      throw new ValidationError(`Batch: BatchSigners[${index}] is not object.`)
    }

    const signerRecord = signerObj
    validateRequiredField(signerRecord, 'BatchSigner', isRecord, {
      paramName: `BatchSigners[${index}].BatchSigner`,
      txType: 'Batch',
    })

    const signer = signerRecord.BatchSigner
    validateRequiredField(signer, 'Account', isString, {
      paramName: `BatchSigners[${index}].BatchSigner.Account`,
      txType: 'Batch',
    })
    validateOptionalField(signer, 'SigningPubKey', isString, {
      paramName: `BatchSigners[${index}].BatchSigner.SigningPubKey`,
      txType: 'Batch',
    })
    validateOptionalField(signer, 'TxnSignature', isString, {
      paramName: `BatchSigners[${index}].BatchSigner.TxnSignature`,
      txType: 'Batch',
    })
    validateOptionalField(signer, 'Signers', isArray, {
      paramName: `BatchSigners[${index}].BatchSigner.Signers`,
      txType: 'Batch',
    })
  })
}
