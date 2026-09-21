import { createHash } from 'node:crypto'

import { decodeAccountID } from 'xrpl'

/** rippled LedgerNameSpace bytes (see rippled `Indexes.cpp`). */
const NS_MPTOKEN_ISSUANCE = '007E' // '~'
const NS_MPTOKEN = '0074' // 't'

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex').toUpperCase()
}

function sha512Half(hexInput: string): string {
  return createHash('sha512')
    .update(Buffer.from(hexInput, 'hex'))
    .digest('hex')
    .slice(0, 64)
    .toUpperCase()
}

/**
 * MPTokenIssuanceID = 32-bit big-endian sequence ‖ 160-bit issuer AccountID,
 * where the sequence is the one the create transaction CONSUMED: `Sequence`,
 * or `TicketSequence` when a ticket was used (AUDIT-047; verified on-ledger).
 *
 * AUDIT-012: the SDK has `getNFTokenID` for NFTs but nothing for MPTs; every
 * caller re-derives this or reaches for `meta.mpt_issuance_id!`.
 */
export function deriveMPTokenIssuanceID(issuer: string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 0 || sequence > 0xffffffff) {
    throw new Error(`sequence out of range: ${sequence}`)
  }
  const seqHex = sequence.toString(16).padStart(8, '0').toUpperCase()
  return `${seqHex}${hex(decodeAccountID(issuer))}`
}

/** Ledger index (keylet) of an MPTokenIssuance entry. */
export function mptIssuanceIndex(issuanceId: string): string {
  return sha512Half(`${NS_MPTOKEN_ISSUANCE}${issuanceId}`)
}

/**
 * Ledger index (keylet) of a holder's MPToken entry.
 *
 * Note the input is the *issuance keylet* (32 bytes), not the 24-byte
 * issuance ID: rippled's `keylet::mptoken(issuanceID, holder)` is
 * `indexHash(MPTOKEN, mptIssuance(issuanceID).key, holder)`. Our first
 * attempt hashed the raw ID and did not match the ledger; exactly the kind of
 * detail an SDK helper should own (AUDIT-012).
 */
export function mptokenIndex(issuanceId: string, holder: string): string {
  return sha512Half(`${NS_MPTOKEN}${mptIssuanceIndex(issuanceId)}${hex(decodeAccountID(holder))}`)
}

/** Split an issuance ID back into its parts. */
export function parseMPTokenIssuanceID(issuanceId: string): { sequence: number; issuerAccountIdHex: string } {
  if (!/^[0-9A-Fa-f]{48}$/u.test(issuanceId)) {
    throw new Error(`not an MPTokenIssuanceID: ${issuanceId}`)
  }
  return {
    sequence: Number.parseInt(issuanceId.slice(0, 8), 16),
    issuerAccountIdHex: issuanceId.slice(8).toUpperCase(),
  }
}
