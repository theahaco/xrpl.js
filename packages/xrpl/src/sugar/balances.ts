import { hexToBytes } from '@xrplf/isomorphic/utils'
import { encodeAccountID } from 'ripple-address-codec'

import {
  AccountLinesTrustline,
  AccountObject,
  Balance,
  MPToken,
} from '../models'

/** Hex characters of the 32-bit issuer sequence that starts an MPTokenIssuanceID. */
const MPT_ISSUANCE_ID_SEQUENCE_HEX_LENGTH = 8

/**
 * Formats an array of trustlines into an array of balances.
 *
 * @param trustlines - The array of trustlines to format.
 * @returns An array of balances, each containing the value, currency, and issuer.
 */
export function formatBalances(trustlines: AccountLinesTrustline[]): Balance[] {
  return trustlines.map((trustline) => ({
    value: trustline.balance,
    currency: trustline.currency,
    issuer: trustline.account,
  }))
}

/**
 * Derives the issuer's classic address from a 192-bit MPTokenIssuanceID
 * (32-bit issuer sequence followed by the 160-bit issuer AccountID).
 *
 * @param mptIssuanceID - The MPTokenIssuanceID as a 48-character hex string.
 * @returns The issuer's classic address.
 */
function issuerFromMPTokenIssuanceID(mptIssuanceID: string): string {
  return encodeAccountID(
    hexToBytes(mptIssuanceID.slice(MPT_ISSUANCE_ID_SEQUENCE_HEX_LENGTH)),
  )
}

/**
 * Formats the `MPToken` entries of an `account_objects` response into an
 * array of balances, one per MPT issuance the account holds.
 *
 * @param accountObjects - The `account_objects` array to format. Entries that
 * are not `MPToken` objects are ignored.
 * @param peer - If given, keep only the issuances issued by this classic address.
 * @returns An array of balances, each containing the value (in the issuance's
 * fractional units), `currency: 'MPT'` and the `mpt_issuance_id`.
 */
export function formatMPTokenBalances(
  accountObjects: AccountObject[],
  peer?: string,
): Balance[] {
  return accountObjects
    .filter((object): object is MPToken => object.LedgerEntryType === 'MPToken')
    .filter(
      (mptoken) =>
        peer == null ||
        issuerFromMPTokenIssuanceID(mptoken.MPTokenIssuanceID) === peer,
    )
    .map((mptoken) => ({
      value: mptoken.MPTAmount ?? '0',
      currency: 'MPT',
      mpt_issuance_id: mptoken.MPTokenIssuanceID,
    }))
}
