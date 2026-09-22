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
 * Enum representing values of {@link Batch} transaction flags. Exactly one of
 * them must be set; it selects how the inner transactions are applied and
 * which of them end up in the ledger (see {@link Batch}).
 *
 * @category Transaction Flags
 */
export enum BatchFlags {
  /**
   * Apply every inner transaction, or none: if any inner transaction fails,
   * all of them are reverted and none is recorded in the ledger. The outer
   * `Batch` is still `tesSUCCESS`.
   */
  tfAllOrNothing = 0x00010000,
  /**
   * Apply inner transactions in order until the first one succeeds; the
   * remaining ones are skipped and not recorded in the ledger.
   */
  tfOnlyOne = 0x00020000,
  /**
   * Apply inner transactions in order until the first one fails; the failing
   * one is recorded with its result and the remaining ones are skipped.
   */
  tfUntilFailure = 0x00040000,
  /**
   * Apply every inner transaction regardless of the others' outcome; each is
   * recorded in the ledger with its own result.
   */
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

/**
 * The signature of one additional account whose inner transactions a
 * {@link Batch} contains. Produced by `signMultiBatch` and merged with
 * `combineBatchSigners`; the outer `Account` does not sign here.
 */
export interface BatchSigner {
  BatchSigner: {
    /** An account other than the outer `Account` that owns inner transactions. */
    Account: string

    /** Single-signature: the public key that signed the batch. */
    SigningPubKey?: string

    /** Single-signature: the signature over the batch (`encodeForSigningBatch`). */
    TxnSignature?: string

    /** Multi-signature: the signer list entries, instead of `SigningPubKey`/`TxnSignature`. */
    Signers?: Signer[]
  }
}

/**
 * A Batch transaction (XLS-56) submits several inner transactions in one
 * atomic-per-mode unit.
 *
 * Each inner transaction is embedded unsigned in `RawTransactions`, carrying
 * the `tfInnerBatchTxn` flag, `Fee: '0'`, `SigningPubKey: ''`, no
 * `TxnSignature`/`Signers`/`LastLedgerSequence`, and its own `Sequence` (or
 * `TicketSequence` with `Sequence: 0`). `Client.autofill` fills these in.
 * Inner transactions from an account other than the outer `Account` require
 * that account's signature in `BatchSigners`.
 *
 * @remarks
 * **Outcome model.** The outer `Batch` and its inner transactions have separate
 * outcomes. The outer transaction's `tesSUCCESS` (from `submit`'s `engine_result`
 * or `submitAndWait`'s `meta.TransactionResult`) means only that the batch was
 * processed; it does not mean that any inner transaction took effect. The
 * {@link BatchFlags} mode decides what happens on an inner failure:
 *
 * - `tfAllOrNothing`: one failing inner transaction reverts all of them. None
 *   appears in the ledger, and the outer `Batch` is still `tesSUCCESS`.
 * - `tfIndependent`, `tfUntilFailure`, `tfOnlyOne`: every inner transaction that
 *   was applied (successfully or with a `tec` result) is recorded as its own
 *   validated transaction, in the same ledger as the outer one, with
 *   `meta.ParentBatchID` set to the outer hash; skipped ones are not recorded.
 *
 * To learn what happened, hash each inner transaction with
 * `getBatchInnerHashes` and look it up with the `tx` method, or call
 * `Client.getBatchResults(outerHash)`, which does both and reports
 * `'not-applied'` for inner transactions the ledger does not know.
 *
 * There is no dry run: rippled's `simulate` does not support `Batch`.
 *
 * @example
 * ```ts
 * const batch: Batch = {
 *   TransactionType: 'Batch',
 *   Account: wallet.address,
 *   Flags: BatchFlags.tfAllOrNothing,
 *   RawTransactions: [{ RawTransaction: payment1 }, { RawTransaction: payment2 }],
 * }
 * const response = await client.submitAndWait(batch, { wallet })
 * // 'tesSUCCESS' even if payment1 and payment2 were both reverted
 * console.log(response.result.meta.TransactionResult)
 * const inner = await client.getBatchResults(response.result.hash)
 * // e.g. [{ hash, result: 'not-applied' }, { hash, result: 'not-applied' }]
 * console.log(inner)
 * ```
 *
 * @category Transaction Models
 */
export interface Batch extends BaseTransaction {
  TransactionType: 'Batch'

  /**
   * Signatures of every account, other than the outer `Account`, that owns an
   * inner transaction. Omit when all inner transactions belong to `Account`.
   */
  BatchSigners?: BatchSigner[]

  /**
   * The inner transactions, applied in order according to the {@link BatchFlags}
   * mode. Each must carry `tfInnerBatchTxn` and be unsigned; nesting a `Batch`
   * is not allowed.
   */
  RawTransactions: Array<{
    RawTransaction: SubmittableTransaction
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

  validateRequiredField(tx, 'RawTransactions', isArray)

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
