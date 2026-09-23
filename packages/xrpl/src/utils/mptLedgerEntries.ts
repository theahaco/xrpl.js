import type { Client } from '../client'
import { RippledError } from '../errors'
import type { LedgerIndex } from '../models/common'
import type { MPToken, MPTokenIssuance } from '../models/ledger'

/**
 * The part of a {@link Client} the MPT read helpers use: just `request`. Taking
 * this rather than a whole `Client` lets the helpers be called with anything
 * that can issue a request — a `Client`, a pooled wrapper, or a stub in tests.
 *
 * @category Utilities
 */
export type MPTLedgerReader = Pick<Client, 'request'>

const ENTRY_NOT_FOUND = 'entryNotFound'

async function orUndefined<T>(read: Promise<T>): Promise<T | undefined> {
  try {
    return await read
  } catch (error) {
    if (error instanceof RippledError && error.code === ENTRY_NOT_FOUND) {
      return undefined
    }
    throw error
  }
}

/**
 * Fetch a single `MPToken` ledger entry: one holder's balance of, and
 * authorization for, one MPT issuance.
 *
 * This convenience lookup lets callers read a
 * holder's `MPTAmount`, `LockedAmount` and `Flags` (`lsfMPTLocked`,
 * `lsfMPTAuthorized`) without an assertion at the call site. Get the
 * `mptIssuanceID` from {@link getMPTokenIssuanceID}.
 *
 * @example
 * ```ts
 * const mptoken = await fetchMPToken(client, holder, mptIssuanceID)
 * console.log(mptoken.MPTAmount, mptoken.LockedAmount)
 * ```
 *
 * @param client - A connected Client (or anything with its `request`).
 * @param account - The classic XRPL address of the token holder.
 * @param mptIssuanceID - The 24-byte hex MPTokenIssuanceID.
 * @param ledgerIndex - Ledger to read at; the server default (current) when
 *   omitted. Pin it when several reads must come from one coherent ledger.
 * @returns The holder's MPToken ledger entry.
 * @throws {RippledError} If the holder has no MPToken for the issuance
 *   (`entryNotFound`) — use {@link fetchMPTokenOrUndefined} to get `undefined`
 *   instead.
 * @category Utilities
 */
// eslint-disable-next-line max-params -- a client plus the (account, issuance) lookup and its ledger
export async function fetchMPToken(
  client: MPTLedgerReader,
  account: string,
  mptIssuanceID: string,
  ledgerIndex?: LedgerIndex,
): Promise<MPToken> {
  const response = await client.request({
    command: 'ledger_entry',
    mptoken: { mpt_issuance_id: mptIssuanceID, account },
    ledger_index: ledgerIndex,
  })
  return response.result.node
}

/**
 * Fetch the `MPTokenIssuance` ledger entry for an MPT: the issuer's definition
 * of the token — `AssetScale`, `TransferFee`, `MaximumAmount`,
 * `OutstandingAmount`, `DomainID`, and the issuance flags (`lsfMPTCanClawback`,
 * `lsfMPTCanLock`, `lsfMPTLocked`, ...).
 *
 * @example
 * ```ts
 * const issuance = await fetchMPTokenIssuance(client, mptIssuanceID)
 * const outstanding = unitsToMpt(issuance.OutstandingAmount, issuance.AssetScale)
 * ```
 *
 * @param client - A connected Client (or anything with its `request`).
 * @param mptIssuanceID - The 24-byte hex MPTokenIssuanceID.
 * @param ledgerIndex - Ledger to read at; the server default (current) when
 *   omitted.
 * @returns The MPTokenIssuance ledger entry.
 * @throws {RippledError} If the issuance does not exist (`entryNotFound`) — use
 *   {@link fetchMPTokenIssuanceOrUndefined} to get `undefined` instead.
 * @category Utilities
 */
export async function fetchMPTokenIssuance(
  client: MPTLedgerReader,
  mptIssuanceID: string,
  ledgerIndex?: LedgerIndex,
): Promise<MPTokenIssuance> {
  const response = await client.request({
    command: 'ledger_entry',
    mpt_issuance: mptIssuanceID,
    ledger_index: ledgerIndex,
  })
  return response.result.node
}

/**
 * {@link fetchMPToken}, but `undefined` instead of an `entryNotFound` error
 * when the holder holds no MPToken for the issuance.
 *
 * "Does this account hold the token?" is the common question, and answering it
 * with {@link fetchMPToken} means catching an error and re-inspecting its code.
 * Every other failure (a bad ID, a disconnected client) still throws.
 *
 * @param client - A connected Client (or anything with its `request`).
 * @param account - The classic XRPL address of the token holder.
 * @param mptIssuanceID - The 24-byte hex MPTokenIssuanceID.
 * @param ledgerIndex - Ledger to read at; the server default when omitted.
 * @returns The holder's MPToken ledger entry, or `undefined` if there is none.
 * @category Utilities
 */
// eslint-disable-next-line max-params -- mirrors fetchMPToken
export async function fetchMPTokenOrUndefined(
  client: MPTLedgerReader,
  account: string,
  mptIssuanceID: string,
  ledgerIndex?: LedgerIndex,
): Promise<MPToken | undefined> {
  return orUndefined(fetchMPToken(client, account, mptIssuanceID, ledgerIndex))
}

/**
 * {@link fetchMPTokenIssuance}, but `undefined` instead of an `entryNotFound`
 * error when no such issuance exists (never created, or destroyed).
 *
 * @param client - A connected Client (or anything with its `request`).
 * @param mptIssuanceID - The 24-byte hex MPTokenIssuanceID.
 * @param ledgerIndex - Ledger to read at; the server default when omitted.
 * @returns The MPTokenIssuance ledger entry, or `undefined` if there is none.
 * @category Utilities
 */
export async function fetchMPTokenIssuanceOrUndefined(
  client: MPTLedgerReader,
  mptIssuanceID: string,
  ledgerIndex?: LedgerIndex,
): Promise<MPTokenIssuance | undefined> {
  return orUndefined(fetchMPTokenIssuance(client, mptIssuanceID, ledgerIndex))
}
