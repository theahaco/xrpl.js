import type {
  Client,
  SubmitRequest,
  SubmitResponse,
  SubmittableTransaction,
  Transaction,
  Wallet,
} from '..'
import {
  RippledError,
  TransactionFailedError,
  ValidationError,
  XrplError,
} from '../errors'
import { Signer } from '../models/common'
import { TxResponse } from '../models/methods'
import { BaseTransaction } from '../models/transactions/common'
import { decode, encode } from '../utils'

/** Approximate time for a ledger to close, in milliseconds */
const LEDGER_CLOSE_TIME = 1000

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

// Helper functions

/**
 * Submits a request to the client with a signed transaction.
 *
 * @param client - The client to submit the request to.
 * @param signedTransaction - The signed transaction to submit. It can be either a Transaction object or a
 * string (encode from ripple-binary-codec) representation of the transaction.
 * @param [failHard=false] - Optional. Determines whether the submission should fail hard (true) or not (false). Default is false.
 * @returns A promise that resolves with the response from the client.
 * @throws {ValidationError} If the signed transaction is not valid (not signed).
 *
 * @example
 * import { Client } from "xrpl"
 * const client = new Client("wss://s.altnet.rippletest.net:51233");
 * await client.connect();
 * const signedTransaction = createSignedTransaction();
 * // Example 1: Submitting a Transaction object
 * const response1 = await submitRequest(client, signedTransaction);
 *
 * // Example 2: Submitting a string representation of the transaction
 * const signedTransactionString = encode(signedTransaction);
 * const response2 = await submitRequest(client, signedTransactionString, true);
 */
export async function submitRequest(
  client: Client,
  signedTransaction: SubmittableTransaction | string,
  failHard = false,
): Promise<SubmitResponse> {
  if (!isSigned(signedTransaction)) {
    throw new ValidationError('Transaction must be signed.')
  }

  const signedTxEncoded =
    typeof signedTransaction === 'string'
      ? signedTransaction
      : encode(signedTransaction)
  const request: SubmitRequest = {
    command: 'submit',
    tx_blob: signedTxEncoded,
    fail_hard: isAccountDelete(signedTransaction) || failHard,
  }
  return client.request(request)
}

/**
 * Looks a transaction up by hash, distinguishing "rippled does not know this transaction"
 * from every other failure.
 *
 * @param client - The client to use for the `tx` request.
 * @param txHash - The hash of the transaction to look up.
 * @param submissionResult - The preliminary result of the transaction, for the error message.
 * @returns The `tx` response, or `undefined` if rippled answered `txnNotFound`.
 * @throws {XrplError} Any other library error (`RippledError`, `TimeoutError`,
 * `DisconnectedError`, ...) is re-thrown unchanged so callers keep its class and `data`;
 * anything else is wrapped in an `XrplError` whose `data` is the original error.
 */
async function lookupTransaction(
  client: Client,
  txHash: string,
  submissionResult: string,
): Promise<TxResponse | undefined> {
  try {
    return await client.request({ command: 'tx', transaction: txHash })
  } catch (error: unknown) {
    if (error instanceof RippledError && isTxnNotFound(error.data)) {
      return undefined
    }
    if (error instanceof XrplError) {
      throw error
    }
    throw new XrplError(
      `Failed to look up transaction ${txHash} while waiting for its final outcome.\n` +
        `Preliminary result: ${submissionResult}`,
      error,
    )
  }
}

function isTxnNotFound(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data != null &&
    'error' in data &&
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrowed by the `in` check above
    (data as { error: unknown }).error === 'txnNotFound'
  )
}

/**
 * Whether a preliminary `submit` result means rippled neither applied, queued, nor relayed
 * the transaction, so this submission can never reach a ledger on its own.
 *
 * - `tem*`: malformed.
 * - `tef*`: failed; cannot be applied to the current ledger or any later one.
 * - `tel*`: local error; not applied and not relayed.
 *
 * `tefALREADY` is the exception: it means the exact transaction is already in the open ledger
 * (a re-submission), so it is still expected to be validated.
 *
 * `tes*`, `tec*` and `ter*` are not terminal: the transaction was applied (charging a fee
 * for `tec*`) or held for retry (`ter*`, e.g. `terQUEUED`) and may still be validated.
 *
 * @param engineResult - The `engine_result` of a `submit` response.
 * @returns `true` if the submission is terminal.
 */
export function isTerminalSubmissionResult(engineResult: string): boolean {
  if (engineResult === 'tefALREADY') {
    return false
  }
  return (
    engineResult.startsWith('tem') ||
    engineResult.startsWith('tef') ||
    engineResult.startsWith('tel')
  )
}

/**
 * Waits for the final outcome of a transaction by polling the ledger until the result can be considered final,
 * meaning it has either been included in a validated ledger, or the transaction's lastLedgerSequence has been
 * surpassed by the latest ledger sequence (meaning it will never be included in a validated ledger).
 *
 * Each poll reads the latest validated ledger index *before* looking the transaction up, and only reports
 * expiry when the transaction is not validated after that lookup. This way a transaction validated in its
 * last allowed ledger is returned even when several ledgers close between two polls.
 *
 * @template T - The type of the transaction. Defaults to `Transaction`.
 * @param client - The client to use for requesting transaction information.
 * @param txHash - The hash of the transaction to wait for.
 * @param lastLedger - The last ledger sequence of the transaction.
 * @param submissionResult - The preliminary result of the transaction.
 * @returns A promise that resolves with the final transaction response.
 *
 * @throws {TransactionFailedError} With `phase: 'expired'` and `engineResult` set to the preliminary result
 * if the latest validated ledger sequence surpasses the transaction's lastLedgerSequence without the
 * transaction being validated.
 * @throws {XrplError} If a `tx` lookup fails for a reason other than `txnNotFound` (e.g. `TimeoutError`,
 * `DisconnectedError`, or a `RippledError` such as `tooBusy`); the original error is re-thrown unchanged.
 *
 * @example
 * import { hashes, Client } from "xrpl"
 * const client = new Client("wss://s.altnet.rippletest.net:51233")
 * await client.connect()
 *
 * const transaction = createTransaction() // your transaction function
 *
 * const signedTx = await getSignedTx(this, transaction)
 *
 * const lastLedger = getLastLedgerSequence(signedTx)
 *
 * if (lastLedger == null) {
 *   throw new ValidationError(
 *     'Transaction must contain a LastLedgerSequence value for reliable submission.',
 *   )
 * }
 *
 * const response = await submitRequest(this, signedTx, opts?.failHard)
 *
 * const txHash = hashes.hashSignedTx(signedTx)
 * return waitForFinalTransactionOutcome(
 *   this,
 *   txHash,
 *   lastLedger,
 *   response.result.engine_result,
 * )
 */
// eslint-disable-next-line max-params -- this function needs to display and do with more information.
export async function waitForFinalTransactionOutcome<
  T extends BaseTransaction = SubmittableTransaction,
>(
  client: Client,
  txHash: string,
  lastLedger: number,
  submissionResult: string,
): Promise<TxResponse<T>> {
  await sleep(LEDGER_CLOSE_TIME)

  // Read the validated ledger index before the lookup: if it is already past `lastLedger`, every ledger
  // the transaction could have landed in is validated too, so a non-validated lookup result is final.
  const latestLedger = await client.getLedgerIndex()

  const txResponse = await lookupTransaction(client, txHash, submissionResult)

  if (txResponse?.result.validated) {
    // TODO: resolve the type assertion below
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- we know that txResponse is of type TxResponse
    return txResponse as TxResponse<T>
  }

  if (lastLedger < latestLedger) {
    throw new TransactionFailedError(
      `The latest ledger sequence ${latestLedger} is greater than the transaction's LastLedgerSequence (${lastLedger}).\n` +
        `Preliminary result: ${submissionResult}`,
      { engineResult: submissionResult, phase: 'expired' },
    )
  }

  return waitForFinalTransactionOutcome<T>(
    client,
    txHash,
    lastLedger,
    submissionResult,
  )
}

/**
 * Handles a terminal preliminary `submit` result: throws a `TransactionFailedError`, unless an earlier
 * submission of the same signed blob already got the transaction into a validated ledger, in which case
 * that validated transaction is returned.
 *
 * A `tem*` result is malformed and thrown at once. A `tef*` or `tel*` result means this submission was
 * neither applied, queued, nor relayed, so polling until `LastLedgerSequence` passes would only delay the
 * same answer. The one way such a transaction can still be validated is if an earlier submission got it
 * there (e.g. `tefPAST_SEQ` when re-submitting after a disconnect), so the hash is looked up once. rippled
 * also keeps rejected transactions in its local cache and reports them as not validated, so only a
 * `validated` lookup counts.
 *
 * @template T - The type of the transaction.
 * @param client - The client to use for the lookup.
 * @param response - The `submit` response.
 * @param txHash - The hash of the submitted transaction.
 * @returns The validated transaction if it is already on the ledger; `undefined` when the submission is
 * not terminal and the caller should keep polling.
 * @throws {TransactionFailedError} With `phase: 'submit'` when the transaction will never reach a ledger.
 */
export async function handleTerminalSubmission<
  T extends BaseTransaction = SubmittableTransaction,
>(
  client: Client,
  response: SubmitResponse,
  txHash: string,
): Promise<TxResponse<T> | undefined> {
  const {
    engine_result: engineResult,
    engine_result_message: engineResultMessage,
  } = response.result
  if (!isTerminalSubmissionResult(engineResult)) {
    return undefined
  }

  const failure = new TransactionFailedError(
    `Transaction failed, ${engineResult}: ${engineResultMessage}`,
    { engineResult, engineResultMessage, phase: 'submit' },
    response.result,
  )

  if (engineResult.startsWith('tem')) {
    throw failure
  }

  const txResponse = await lookupTransaction(client, txHash, engineResult)
  if (txResponse?.result.validated) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- we know that txResponse is of type TxResponse
    return txResponse as TxResponse<T>
  }
  throw failure
}

// checks if the transaction has been signed
function isSigned(transaction: SubmittableTransaction | string): boolean {
  const tx = typeof transaction === 'string' ? decode(transaction) : transaction
  if (typeof tx === 'string') {
    return false
  }
  if (tx.Signers != null) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- we know that tx.Signers is an array of Signers
    const signers = tx.Signers as Signer[]
    for (const signer of signers) {
      if (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- necessary check
        signer.Signer.SigningPubKey == null ||
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- necessary check
        signer.Signer.TxnSignature == null
      ) {
        return false
      }
    }
    return true
  }
  return tx.SigningPubKey != null && tx.TxnSignature != null
}

/**
 * Updates a transaction with `autofill` then signs it if it is unsigned.
 *
 * @param client - The client from which to retrieve the signed transaction.
 * @param transaction - The transaction to retrieve. It can be either a Transaction object or
 * a string (encode from ripple-binary-codec) representation of the transaction.
 * @param [options={}] - Optional. Additional options for retrieving the signed transaction.
 * @param [options.autofill=true] - Optional. Determines whether the transaction should be autofilled (true)
 * or not (false). Default is true.
 * @param [options.wallet] - Optional. A wallet to sign the transaction. It must be provided when submitting
 * an unsigned transaction. Default is undefined.
 * @returns A promise that resolves with the signed transaction.
 *
 * @throws {ValidationError} If the transaction is not signed and no wallet is provided.
 *
 * @example
 * import { Client } from "xrpl"
 * import { encode } from "ripple-binary-codec"
 *
 * const client = new Client("wss://s.altnet.rippletest.net:51233");
 * await client.connect():
 * const transaction = createTransaction(); // createTransaction is your function to create a transaction
 * const options = {
 *   autofill: true,
 *   wallet: myWallet,
 * };
 *
 * // Example 1: Retrieving a signed Transaction object
 * const signedTx1 = await getSignedTx(client, transaction, options);
 *
 * // Example 2: Retrieving a string representation of the signed transaction
 * const signedTxString = await getSignedTx(client, encode(transaction), options);
 */
export async function getSignedTx(
  client: Client,
  transaction: SubmittableTransaction | string,
  {
    autofill = true,
    wallet,
  }: {
    // If true, autofill a transaction.
    autofill?: boolean
    // A wallet to sign a transaction. It must be provided when submitting an unsigned transaction.
    wallet?: Wallet
  } = {},
): Promise<SubmittableTransaction | string> {
  if (isSigned(transaction)) {
    return transaction
  }

  if (!wallet) {
    throw new ValidationError(
      'Wallet must be provided when submitting an unsigned transaction',
    )
  }

  let tx =
    typeof transaction === 'string'
      ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- converts JsonObject to correct Transaction type
        (decode(transaction) as unknown as SubmittableTransaction)
      : transaction

  if (autofill) {
    tx = await client.autofill(tx)
  }

  return wallet.sign(tx).tx_blob
}

// checks if there is a LastLedgerSequence as a part of the transaction
/**
 * Retrieves the last ledger sequence from a transaction.
 *
 * @param transaction - The transaction to retrieve the last ledger sequence from. It can be either a Transaction object or
 * a string (encode from ripple-binary-codec) representation of the transaction.
 * @returns The last ledger sequence of the transaction, or null if not available.
 *
 * @example
 * const transaction = createTransaction(); // your function to create a transaction
 *
 * // Example 1: Retrieving the last ledger sequence from a Transaction object
 * const lastLedgerSequence1 = getLastLedgerSequence(transaction);
 * console.log(lastLedgerSequence1); // Output: 12345
 *
 * // Example 2: Retrieving the last ledger sequence from a string representation of the transaction
 * const transactionString = encode(transaction);
 * const lastLedgerSequence2 = getLastLedgerSequence(transactionString);
 * console.log(lastLedgerSequence2); // Output: 67890
 */
export function getLastLedgerSequence(
  transaction: Transaction | string,
): number | null {
  const tx = typeof transaction === 'string' ? decode(transaction) : transaction
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- converts LastLedgerSeq to number if present.
  return tx.LastLedgerSequence as number | null
}

// checks if the transaction is an AccountDelete transaction
function isAccountDelete(transaction: Transaction | string): boolean {
  const tx = typeof transaction === 'string' ? decode(transaction) : transaction
  return tx.TransactionType === 'AccountDelete'
}
