import type { Batch } from '../models/transactions/batch'

import { hashSignedTx } from './hashes'

/**
 * Computes the ledger hash of every inner transaction of a {@link Batch}, in
 * `RawTransactions` order.
 *
 * Inner transactions are unsigned (`SigningPubKey: ''`, no `TxnSignature`) and
 * carry the `tfInnerBatchTxn` flag, so their hash is the hash of the raw
 * transaction exactly as it is embedded in the outer `Batch`. When an inner
 * transaction is applied it appears in the ledger under this hash, as its own
 * validated transaction whose metadata carries `ParentBatchID`; when it is not
 * applied (reverted or skipped) the hash is not found by the `tx` method.
 *
 * Pass the `Batch` in the form it was submitted (after `autofill`), since any
 * field that differs (`Sequence`, `Fee`, `NetworkID`, ...) changes the hash.
 *
 * @param batch - A Batch transaction whose inner transactions are fully filled in.
 * @returns The hash of each inner transaction, in `RawTransactions` order.
 * @category Utilities
 */
export default function getBatchInnerHashes(batch: Batch): string[] {
  return batch.RawTransactions.map((rawTxn) =>
    hashSignedTx(rawTxn.RawTransaction),
  )
}
