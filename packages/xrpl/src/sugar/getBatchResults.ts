import type { Client } from '..'
import { ValidationError } from '../errors'
import type { TxResponse } from '../models/methods'
import type { Batch } from '../models/transactions/batch'
import type { SubmittableTransaction } from '../models/transactions/transaction'
import { getBatchInnerHashes } from '../utils'

/**
 * The `result` of a {@link BatchInnerResult} whose inner transaction is not in
 * the ledger: it was reverted (`tfAllOrNothing`), skipped after an earlier
 * inner transaction failed (`tfUntilFailure`) or succeeded (`tfOnlyOne`), or
 * the outer `Batch` itself was not applied.
 */
export const BATCH_INNER_NOT_APPLIED = 'not-applied'

/**
 * The outcome of one inner transaction of a {@link Batch}, as reported by
 * {@link Client.getBatchResults}.
 *
 * @category Abstraction
 */
export interface BatchInnerResult {
  /** The hash of the inner transaction (see `getBatchInnerHashes`). */
  hash: string
  /**
   * The inner transaction's `meta.TransactionResult` (`tesSUCCESS`, `tec...`)
   * when it was applied to the ledger as its own transaction, or
   * `'not-applied'` ({@link BATCH_INNER_NOT_APPLIED}) when the `tx` method
   * does not find it. Under `tfAllOrNothing` every inner transaction is
   * `'not-applied'` as soon as one of them fails, while the outer `Batch` still
   * reports `tesSUCCESS`.
   */
  result: string
  /**
   * The `tx` response for the inner transaction. Its `meta.ParentBatchID` is
   * the hash of the outer `Batch`. Absent when `result` is `'not-applied'`.
   */
  tx?: TxResponse<SubmittableTransaction>
}

async function fetchOuterBatch(client: Client, hash: string): Promise<Batch> {
  const response = await client.request({ command: 'tx', transaction: hash })
  const outer = response.result.tx_json
  if (outer.TransactionType !== 'Batch') {
    throw new ValidationError(
      `getBatchResults: transaction ${hash} is a ${outer.TransactionType}, not a Batch.`,
    )
  }
  return outer
}

async function fetchInnerResult(
  client: Client,
  hash: string,
): Promise<BatchInnerResult> {
  let tx: TxResponse<SubmittableTransaction>
  try {
    tx = await client.request({ command: 'tx', transaction: hash })
  } catch (error) {
    // A `tx` lookup that misses is the one signal an inner transaction was not applied.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- RippledError.data is the raw error response
    const rippledError = (error as { data?: { error?: unknown } }).data?.error
    if (rippledError === 'txnNotFound') {
      return { hash, result: BATCH_INNER_NOT_APPLIED }
    }
    throw error
  }
  const { meta } = tx.result
  if (typeof meta !== 'object') {
    throw new ValidationError(
      `getBatchResults: inner transaction ${hash} has no metadata; it may not be validated yet.`,
    )
  }
  return { hash, result: meta.TransactionResult, tx }
}

/**
 * Looks up the outcome of every inner transaction of a validated {@link Batch}.
 *
 * The outer `Batch` reports `tesSUCCESS` whenever it was processed, even when
 * none of its inner transactions took effect. This helper computes each inner
 * transaction's hash ({@link getBatchInnerHashes}) and looks it up with the
 * `tx` method, so the caller can tell which inner transactions were applied.
 *
 * @param client - The Client used to connect to the ledger.
 * @param batch - Either the hash of the validated outer `Batch` or the `Batch`
 * exactly as it was submitted (after `autofill`).
 * @returns One {@link BatchInnerResult} per inner transaction, in `RawTransactions` order.
 * @throws ValidationError if `batch` is a hash that resolves to a transaction
 * other than a `Batch`, or an inner transaction is found but not yet validated.
 * @throws RippledError if the outer `Batch` cannot be found, or a `tx` lookup
 * fails for any reason other than `txnNotFound`.
 */
export default async function getBatchResults(
  client: Client,
  batch: Batch | string,
): Promise<BatchInnerResult[]> {
  const outer =
    typeof batch === 'string' ? await fetchOuterBatch(client, batch) : batch
  return Promise.all(
    getBatchInnerHashes(outer).map(async (hash) =>
      fetchInnerResult(client, hash),
    ),
  )
}
