/* eslint-disable max-lines -- one cohesive Batch co-signing module: sign, merge and verify share the payload encoder */
import { encode, encodeForSigningBatch } from 'ripple-binary-codec'
import { sign, verify } from 'ripple-keypairs'

import { ValidationError } from '../errors'
import { Batch, Transaction, validate } from '../models'
import { Signer } from '../models/common'
import { BatchSigner, validateBatch } from '../models/transactions/batch'
import { hashSignedTx } from '../utils/hashes'

import { compareSigners, getDecodedTransaction } from './utils'

import type { Wallet } from './index'

// eslint-disable-next-line max-params -- okay for helper function
function constructBatchSignerObject(
  batchAccount: string,
  wallet: Wallet,
  signature: string,
  multisignAddress: string | false = false,
): BatchSigner {
  let batchSigner: BatchSigner
  if (multisignAddress) {
    batchSigner = {
      BatchSigner: {
        Account: batchAccount,
        Signers: [
          {
            Signer: {
              Account: multisignAddress,
              SigningPubKey: wallet.publicKey,
              TxnSignature: signature,
            },
          },
        ],
      },
    }
  } else {
    batchSigner = {
      BatchSigner: {
        Account: batchAccount,
        SigningPubKey: wallet.publicKey,
        TxnSignature: signature,
      },
    }
  }
  return batchSigner
}

/**
 * Resolve the sequence value bound into a Batch signature: the `Sequence` when
 * non-zero, otherwise the `TicketSequence` value (or 0).
 *
 * @param transaction - The Batch transaction being signed.
 * @returns The sequence value to bind into the signature.
 */
function getBatchSeqValue(transaction: Batch): number {
  const sequence = transaction.Sequence ?? 0
  if (sequence !== 0) {
    return sequence
  }
  return transaction.TicketSequence ?? 0
}

/**
 * The XLS-56 V1_1 payload a `BatchSigner` signs over: the outer account, its
 * sequence value, its flags, every inner transaction ID, the co-signing
 * account and (for a multi-signed `BatchSigner`) the individual signer.
 *
 * @param transaction - The Batch transaction.
 * @param batchAccount - The account whose `BatchSigner` entry this is.
 * @param signerAccount - The `Signer.Account` when the entry is multi-signed.
 * @returns The hex-encoded signing payload.
 */
function encodeBatchSignerPayload(
  transaction: Batch,
  batchAccount: string,
  signerAccount?: string,
): string {
  return encodeForSigningBatch({
    account: transaction.Account,
    sequence: getBatchSeqValue(transaction),
    flags: transaction.Flags,
    txIDs: transaction.RawTransactions.map((rawTx) =>
      hashSignedTx(rawTx.RawTransaction),
    ),
    batchAccount,
    // Multi-signed batch signers also bind the inner signer account.
    ...(signerAccount == null ? {} : { signerAccount }),
  })
}

/**
 * Throws unless every field bound into a `BatchSigner` signature is present:
 * the outer `Sequence`/`TicketSequence` and each inner transaction's
 * `Sequence`/`TicketSequence`, `Fee` and `SigningPubKey`. `Client.autofill`
 * sets all of them; signing before it runs binds `Sequence` 0 and inner
 * hashes that change as soon as the Batch is autofilled.
 *
 * @param transaction - The Batch transaction about to be co-signed.
 * @throws ValidationError naming the missing fields.
 */
function validateBatchIsAutofilled(transaction: Batch): void {
  const missing: string[] = []
  if (getBatchSeqValue(transaction) === 0) {
    missing.push('Sequence (or TicketSequence)')
  }
  transaction.RawTransactions.forEach((rawTx, index) => {
    const inner = rawTx.RawTransaction
    const prefix = `RawTransactions[${index}].RawTransaction.`
    if ((inner.Sequence ?? 0) === 0 && inner.TicketSequence == null) {
      missing.push(`${prefix}Sequence (or TicketSequence)`)
    }
    if (inner.Fee == null) {
      missing.push(`${prefix}Fee`)
    }
    if (inner.SigningPubKey == null) {
      missing.push(`${prefix}SigningPubKey`)
    }
  })
  if (missing.length > 0) {
    throw new ValidationError(
      `signMultiBatch: the Batch must be autofilled (Client.autofill) before it is co-signed, because the signature binds fields that are still missing: ${missing.join(
        ', ',
      )}. Autofill first, co-sign, then submit with autofill: false.`,
    )
  }
}

/**
 * Sign a multi-account Batch transaction on behalf of one of the accounts
 * that authorizes an inner transaction, adding a `BatchSigner` entry.
 *
 * Every account that authorizes an inner transaction must co-sign the Batch:
 * the inner `Account` (or its `Delegate`), the `Sponsor` of a sponsored
 * inner transaction, and the `Counterparty` of an inner transaction that has
 * one. The Batch `Account` itself must not be a `BatchSigner` (rippled
 * rejects it with `temBAD_SIGNER`); it signs the outer transaction with
 * `Wallet.sign`.
 *
 * The Batch must already be autofilled (`Client.autofill`): the signature
 * binds the outer sequence value and the hash of every inner transaction,
 * which autofill changes. The full order is autofill, co-sign with this
 * function (one fragment per co-signer, merged with `combineBatchSigners`),
 * sign the outer transaction with `Wallet.sign`, then submit with
 * `autofill: false`.
 *
 * Signing the same object several times appends: a multi-signed
 * `BatchSigner` collects one `Signer` per call for the same `batchAccount`.
 *
 * @param wallet - Wallet instance.
 * @param transaction - The autofilled Batch transaction to sign.
 * @param opts - Additional options for regular key and multi-signing complexity.
 * @param opts.batchAccount - The account submitting the inner Batch transaction, on behalf of which is this signature.
 * @param opts.multisign - Specify true/false to use multisign or actual address (classic/x-address) to make multisign tx request.
 *                       The actual address is only needed in the case of regular key usage.
 * @throws ValidationError if the transaction is malformed, has not been
 * autofilled, `batchAccount` is the Batch `Account` or does not authorize any
 * inner transaction, or an existing `BatchSigner` for `batchAccount`
 * conflicts with the new signature.
 */
// eslint-disable-next-line max-lines-per-function -- cohesive signing routine
export function signMultiBatch(
  wallet: Wallet,
  transaction: Batch,
  opts: { batchAccount?: string; multisign?: boolean | string } = {},
): void {
  const batchAccount = opts.batchAccount ?? wallet.classicAddress
  let multisignAddress: boolean | string = false
  if (typeof opts.multisign === 'string') {
    multisignAddress = opts.multisign
  } else if (opts.multisign) {
    multisignAddress = wallet.classicAddress
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- for JS purposes
  if (transaction.TransactionType !== 'Batch') {
    throw new ValidationError('Must be a Batch transaction.')
  }
  /*
   * This will throw a more clear error for JS users if the supplied transaction has incorrect formatting
   */
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- validate does not accept Transaction type
  validate(transaction as unknown as Record<string, unknown>)

  validateBatchIsAutofilled(transaction)

  if (batchAccount === transaction.Account) {
    throw new ValidationError(
      `signMultiBatch: ${batchAccount} is the Batch Account; it signs the outer transaction with Wallet.sign, not as a BatchSigner.`,
    )
  }

  // An account must sign the Batch if it authorizes an inner transaction, is
  // the `Sponsor` of one, or is the `Counterparty` of one.
  const involvedAccounts = new Set<string>()
  transaction.RawTransactions.forEach((raw) => {
    // A delegated inner transaction is authorized by the delegate, not the
    // account holder, so the delegate is the required signer when present.
    involvedAccounts.add(
      raw.RawTransaction.Delegate ?? raw.RawTransaction.Account,
    )
    // A sponsored inner transaction carries an empty SponsorSignature
    // placeholder; the sponsor's real authorization is its BatchSigner entry.
    if (raw.RawTransaction.Sponsor != null) {
      involvedAccounts.add(raw.RawTransaction.Sponsor)
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Counterparty only exists on some inner tx types
    const counterparty = (raw.RawTransaction as Record<string, unknown>)
      .Counterparty
    if (typeof counterparty === 'string') {
      involvedAccounts.add(counterparty)
    }
  })
  if (!involvedAccounts.has(batchAccount)) {
    throw new ValidationError(
      'Must be signing for an address submitting a transaction in the Batch.',
    )
  }
  const signature = sign(
    encodeBatchSignerPayload(
      transaction,
      batchAccount,
      typeof multisignAddress === 'string' ? multisignAddress : undefined,
    ),
    wallet.privateKey,
  )

  // eslint-disable-next-line no-param-reassign -- okay for signing
  transaction.BatchSigners = mergeBatchSigners([
    ...(transaction.BatchSigners ?? []),
    constructBatchSignerObject(
      batchAccount,
      wallet,
      signature,
      multisignAddress,
    ),
  ])
}

/**
 * Merges the `BatchSigners` of several co-signed copies of the same Batch
 * into one unsigned Batch, returned as a transaction blob.
 *
 * Each input is the same autofilled Batch carrying the `BatchSigner` entries
 * one or more co-signers added with `signMultiBatch`. Entries for the same
 * account are merged: multi-signed entries pool their `Signers`; identical
 * single-signature entries are de-duplicated. The result is sorted by
 * account as rippled requires.
 *
 * The returned blob is NOT signed: `BatchSigners` is not the outer
 * signature. The Batch `Account` must still sign it (`Wallet.sign`, or
 * `client.submit(blob, { wallet })`), and it must be submitted with
 * `autofill: false` so that the fields the co-signatures bind stay as they
 * were signed. The full order is autofill, co-sign fragments with
 * `signMultiBatch`, combine, sign the outer transaction, submit.
 *
 * @param transactions The co-signed copies of the Batch (objects or blobs) to combine `BatchSigners` values on.
 * @returns The unsigned Batch, as a blob, carrying every `BatchSigner` from the inputs.
 * @throws ValidationError if:
 * - There were no transactions given to combine
 * - Any input is not a Batch, lacks `BatchSigners`, or already carries an outer signature
 * - Any input lists the Batch `Account` as a `BatchSigner`
 * - The inputs were not signed over the same account, sequence, flags and inner transactions
 * - Two entries for the same account carry different signatures, or mix a
 *   single signature with multi-signature `Signers`
 * @category Signing
 */
export function combineBatchSigners(
  transactions: Array<Batch | string>,
): string {
  if (transactions.length === 0) {
    throw new ValidationError('There are 0 transactions to combine.')
  }

  const decodedTransactions: Transaction[] = transactions.map((txOrBlob) => {
    return getDecodedTransaction(txOrBlob)
  })

  decodedTransactions.forEach((tx) => {
    if (tx.TransactionType !== 'Batch') {
      throw new ValidationError('TransactionType must be `Batch`.')
    }
    /*
     * This will throw a more clear error for JS users if any of the supplied transactions has incorrect formatting
     */
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- validate does not accept Transaction type
    validateBatch(tx as unknown as Record<string, unknown>)
    if (tx.BatchSigners == null || tx.BatchSigners.length === 0) {
      throw new ValidationError(
        'For combining Batch transaction signatures, all transactions must include a BatchSigners field containing an array of signatures.',
      )
    }

    if (tx.TxnSignature != null || tx.Signers != null) {
      throw new ValidationError('Batch transaction must be unsigned.')
    }
  })

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- checked above
  const batchTransactions = decodedTransactions as Batch[]

  validateBatchTransactionEquivalence(batchTransactions)

  return encode(getTransactionWithAllBatchSigners(batchTransactions))
}

/**
 * The outcome of checking one `BatchSigner` entry of a Batch.
 */
export interface BatchSignerVerification {
  /** The `BatchSigner.Account` the entry claims to co-sign for. */
  account: string
  /**
   * Whether the entry's signature (or, for a multi-signed entry, every one of
   * its `Signers`) verifies against the Batch as it currently is.
   */
  valid: boolean
}

/**
 * Verifies a keypair signature, treating a malformed signature or key as an
 * invalid signature rather than an error.
 *
 * @param payload - The hex-encoded signing payload.
 * @param signature - The hex-encoded signature.
 * @param publicKey - The hex-encoded public key.
 * @returns Whether the signature verifies.
 */
function verifyOrFalse(
  payload: string,
  signature: string,
  publicKey: string,
): boolean {
  try {
    return verify(payload, signature, publicKey)
  } catch {
    return false
  }
}

/**
 * Verifies every `BatchSigner` co-signature on a Batch against the XLS-56
 * V1_1 payload `signMultiBatch` signs (outer account, sequence value, flags,
 * inner transaction IDs, co-signing account and, for multi-signed entries,
 * each `Signer.Account`).
 *
 * Use it before combining or submitting fragments collected from other
 * parties: `verifySignature` / `Wallet.verifyTransaction` check the outer
 * `TxnSignature` and, on a Batch, also require every `BatchSigner` to verify,
 * but they need an outer-signed transaction; this works on unsigned fragments.
 *
 * @param transaction - The Batch (object or blob) whose `BatchSigners` to check.
 * @returns One entry per `BatchSigner`, in order, each with the account it
 * claims to sign for and whether its signature verifies. An entry with no
 * signature material is reported as invalid. A Batch without `BatchSigners`
 * yields an empty array.
 * @throws ValidationError if the transaction is not a Batch.
 * @category Utilities
 */
export function verifyBatchSigners(
  transaction: Batch | string,
): BatchSignerVerification[] {
  const decodedTx = getDecodedTransaction(transaction)
  if (decodedTx.TransactionType !== 'Batch') {
    throw new ValidationError('TransactionType must be `Batch`.')
  }
  const batch: Batch = decodedTx

  return (batch.BatchSigners ?? []).map(({ BatchSigner: signer }) => {
    const account = signer.Account
    if (signer.Signers != null) {
      return {
        account,
        valid:
          signer.Signers.length > 0 &&
          signer.Signers.every(({ Signer: inner }) =>
            verifyOrFalse(
              encodeBatchSignerPayload(batch, account, inner.Account),
              inner.TxnSignature,
              inner.SigningPubKey,
            ),
          ),
      }
    }
    if (signer.SigningPubKey == null || signer.TxnSignature == null) {
      return { account, valid: false }
    }
    return {
      account,
      valid: verifyOrFalse(
        encodeBatchSignerPayload(batch, account),
        signer.TxnSignature,
        signer.SigningPubKey,
      ),
    }
  })
}

/**
 * Builds a comparison key over every field bound into a Batch signature
 * (XLS-56 V1_1): the outer account, sequence value, flags, and inner
 * transaction IDs. Fragments that disagree on any of these were signed over
 * different payloads and cannot be combined, and any change to them after
 * `signMultiBatch` invalidates every `BatchSigner`.
 *
 * @param tx - The Batch transaction to derive the key from.
 * @returns A stable string key for equivalence comparison.
 */
export function getBatchEquivalenceKey(tx: Batch): string {
  return JSON.stringify({
    account: tx.Account,
    sequence: getBatchSeqValue(tx),
    flags: tx.Flags,
    transactionIDs: tx.RawTransactions.map((rawTx) =>
      hashSignedTx(rawTx.RawTransaction),
    ),
  })
}

/**
 * The transactions should all be equal except for the 'Signers' field.
 *
 * @param transactions - An array of Transactions which are expected to be equal other than 'Signers'.
 * @throws ValidationError if the transactions are not equal in any field other than 'Signers'.
 */
function validateBatchTransactionEquivalence(transactions: Batch[]): void {
  const exampleTransaction = getBatchEquivalenceKey(transactions[0])
  if (
    transactions
      .slice(1)
      .some((tx) => getBatchEquivalenceKey(tx) !== exampleTransaction)
  ) {
    throw new ValidationError(
      'Account, sequence, flags, and transaction hashes must be the same for all provided transactions.',
    )
  }
}

/**
 * Whether two single-signature `BatchSigner` entries carry the same signature.
 *
 * @param left - One entry.
 * @param right - The other entry.
 * @returns True when key and signature match.
 */
function isSameBatchSignature(
  left: BatchSigner['BatchSigner'],
  right: BatchSigner['BatchSigner'],
): boolean {
  return (
    left.SigningPubKey === right.SigningPubKey &&
    left.TxnSignature === right.TxnSignature
  )
}

/**
 * Pools the `Signers` of several multi-signed `BatchSigner` fragments for one
 * account, as `multisign` does for a plain transaction.
 *
 * @param account - The co-signing account.
 * @param fragments - Every `BatchSigner` entry for that account.
 * @returns One `BatchSigner` with the union of the fragments' `Signers`, sorted.
 * @throws ValidationError if the same `Signer.Account` appears with different signatures.
 */
function mergeMultisignedBatchSigner(
  account: string,
  fragments: BatchSigner[],
): BatchSigner {
  const bySignerAccount = new Map<string, Signer>()
  fragments
    .flatMap((fragment) => fragment.BatchSigner.Signers ?? [])
    .forEach((signer) => {
      const existing = bySignerAccount.get(signer.Signer.Account)
      if (
        existing != null &&
        !isSameBatchSignature(existing.Signer, signer.Signer)
      ) {
        throw new ValidationError(
          `BatchSigner for ${account} has conflicting signatures from Signer ${signer.Signer.Account}.`,
        )
      }
      bySignerAccount.set(signer.Signer.Account, signer)
    })

  return {
    BatchSigner: {
      Account: account,
      Signers: Array.from(bySignerAccount.values()).sort((signer1, signer2) =>
        compareSigners(signer1.Signer, signer2.Signer),
      ),
    },
  }
}

/**
 * Merges every `BatchSigner` entry for one account into a single entry.
 *
 * @param account - The co-signing account.
 * @param fragments - Every `BatchSigner` entry for that account.
 * @returns The merged entry.
 * @throws ValidationError if the entries mix a single signature with
 * multi-signature `Signers`, or carry different single signatures.
 */
function mergeBatchSignersForAccount(
  account: string,
  fragments: BatchSigner[],
): BatchSigner {
  const multisigned = fragments.filter(
    (fragment) => fragment.BatchSigner.Signers != null,
  )
  if (multisigned.length === fragments.length) {
    return mergeMultisignedBatchSigner(account, fragments)
  }
  if (multisigned.length > 0) {
    throw new ValidationError(
      `BatchSigner for ${account} mixes a single signature with multi-signature Signers.`,
    )
  }
  const [first, ...rest] = fragments
  if (
    rest.some(
      (fragment) =>
        !isSameBatchSignature(first.BatchSigner, fragment.BatchSigner),
    )
  ) {
    throw new ValidationError(
      `BatchSigner for ${account} has conflicting signatures.`,
    )
  }
  return first
}

/**
 * Merges `BatchSigner` entries so that each account appears once, pooling
 * the `Signers` of multi-signed entries, and sorts them by account.
 *
 * BatchSigners must be strictly ascending and unique by account - see
 * compareSigners' documentation for more details.
 *
 * @param signers - `BatchSigner` entries from one or more fragments.
 * @returns The merged, sorted entries.
 * @throws ValidationError if entries for one account conflict.
 */
function mergeBatchSigners(signers: BatchSigner[]): BatchSigner[] {
  const byAccount = new Map<string, BatchSigner[]>()
  signers.forEach((signer) => {
    const account = signer.BatchSigner.Account
    byAccount.set(account, [...(byAccount.get(account) ?? []), signer])
  })
  return Array.from(byAccount.entries(), ([account, fragments]) =>
    mergeBatchSignersForAccount(account, fragments),
  ).sort((signer1, signer2) =>
    compareSigners(signer1.BatchSigner, signer2.BatchSigner),
  )
}

function getTransactionWithAllBatchSigners(transactions: Batch[]): Batch {
  return {
    ...transactions[0],
    BatchSigners: mergeBatchSigners(
      transactions.flatMap((tx) => tx.BatchSigners ?? []),
    ),
  }
}
