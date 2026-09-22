import {
  Client,
  SubmittableTransaction,
  TransactionMetadata,
  TxResponse,
  Wallet,
} from 'xrpl'

export interface Applied<T extends SubmittableTransaction> {
  response: TxResponse<T>
  meta: TransactionMetadata<T>
  /** Engine result code, e.g. `tesSUCCESS` or `tecNO_AUTH`. */
  result: string
}

/**
 * Narrow `response.result.meta` to decoded metadata.
 *
 * AUDIT-001: on the `submitAndWait` path `meta` is typed
 * `TransactionMetadata<T> | string | undefined` although the sugar never asks
 * for binary metadata and only returns once `validated` is true. A runtime
 * guard is the only way to get at `TransactionResult` without `!`/`as`.
 */
export function requireMeta<T extends SubmittableTransaction>(
  response: TxResponse<T>,
): TransactionMetadata<T> {
  const { meta } = response.result
  if (meta === undefined) {
    throw new Error(`transaction ${response.result.hash} has no metadata`)
  }
  if (typeof meta === 'string') {
    throw new Error(`transaction ${response.result.hash} returned binary metadata`)
  }
  return meta
}

/** Autofill, sign, submit, wait for validation, and return the decoded outcome. */
export async function submit<T extends SubmittableTransaction>(
  client: Client,
  tx: T,
  wallet: Wallet,
): Promise<Applied<T>> {
  const response = await client.submitAndWait(tx, { wallet, autofill: true })
  const meta = requireMeta(response)
  return { response, meta, result: meta.TransactionResult }
}

/** Submit and assert `tesSUCCESS`. */
export async function submitOk<T extends SubmittableTransaction>(
  client: Client,
  tx: T,
  wallet: Wallet,
): Promise<Applied<T>> {
  const applied = await submit(client, tx, wallet)
  if (applied.result !== 'tesSUCCESS') {
    throw new Error(
      `${tx.TransactionType} expected tesSUCCESS, got ${applied.result} (${applied.response.result.hash})`,
    )
  }
  return applied
}

const TEM_PATTERN = /Transaction failed, (?<code>te[a-zA-Z_]+):/u
const PRELIM_PATTERN = /Preliminary result: (?<code>te[a-zA-Z_]+)/u

/**
 * Extract an engine result code from the error `submitAndWait` throws.
 *
 * AUDIT-025: `submitAndWait` has three different failure surfaces: `tem*` at
 * submission throws an `XrplError` whose message embeds the code; `tec*`
 * resolves normally with the code in `meta.TransactionResult`; `tef*`/`ter*`/
 * `tel*` neither throw nor validate, so the call spins until
 * `LastLedgerSequence` passes and then throws with "Preliminary result: …".
 * There is no typed accessor for the code in either error, so callers scrape
 * the message.
 */
export function engineResultFromError(err: unknown): string | undefined {
  if (!(err instanceof Error)) {
    return undefined
  }
  const tem = TEM_PATTERN.exec(err.message)?.groups?.['code']
  if (tem !== undefined) {
    return tem
  }
  return PRELIM_PATTERN.exec(err.message)?.groups?.['code']
}

/**
 * Submit a transaction that is expected to fail (or succeed) with a specific
 * engine result, regardless of which of the three surfaces reports it.
 */
export async function submitExpecting<T extends SubmittableTransaction>(
  client: Client,
  tx: T,
  wallet: Wallet,
  expected: string,
): Promise<string> {
  let actual: string
  try {
    actual = (await submit(client, tx, wallet)).result
  } catch (err) {
    const code = engineResultFromError(err)
    if (code === undefined) {
      throw err
    }
    actual = code
  }
  if (actual !== expected) {
    throw new Error(`${tx.TransactionType}: expected ${expected}, got ${actual}`)
  }
  return actual
}

/**
 * Submit and return whatever engine result came back, from any of the three
 * surfaces. Used when the audit wants to *observe* rippled rather than assert.
 */
export async function submitObserve<T extends SubmittableTransaction>(
  client: Client,
  tx: T,
  wallet: Wallet,
): Promise<string> {
  try {
    return (await submit(client, tx, wallet)).result
  } catch (err) {
    const code = engineResultFromError(err)
    if (code === undefined) {
      throw err
    }
    return code
  }
}
