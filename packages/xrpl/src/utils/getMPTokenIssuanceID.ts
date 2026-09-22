import { bytesToHex, hexToBytes } from '@xrplf/isomorphic/utils'
import {
  decodeAccountID,
  encodeAccountID,
  isValidXAddress,
  xAddressToClassicAddress,
} from 'ripple-address-codec'
import { decode } from 'ripple-binary-codec'

import { ValidationError } from '../errors'
import {
  isCreatedNode,
  TransactionMetadata,
} from '../models/transactions/metadata'
import type { MPTokenIssuanceCreate } from '../models/transactions/MPTokenIssuanceCreate'

const HEX = 16
const SEQUENCE_HEX_LENGTH = 8
const ACCOUNT_ID_HEX_LENGTH = 40
const MPT_ISSUANCE_ID_LENGTH = SEQUENCE_HEX_LENGTH + ACCOUNT_ID_HEX_LENGTH
const MAX_UINT32 = 0xffffffff
const MPT_ISSUANCE_ID_REGEX = /^[0-9A-Fa-f]{48}$/u

/**
 * The fields of an {@link MPTokenIssuanceCreate} that determine its
 * MPTokenIssuanceID: the issuer and the sequence the transaction consumes.
 */
export type MPTokenIssuanceIDSource = Pick<
  MPTokenIssuanceCreate,
  'Account' | 'Sequence' | 'TicketSequence'
>

function accountIdHex(address: string): string {
  const classicAddress = isValidXAddress(address)
    ? xAddressToClassicAddress(address).classicAddress
    : address
  return bytesToHex(decodeAccountID(classicAddress))
}

function deriveMPTokenIssuanceID(issuer: string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 0 || sequence > MAX_UINT32) {
    throw new ValidationError(
      `getMPTokenIssuanceID: sequence must be a 32-bit unsigned integer, got ${String(
        sequence,
      )}`,
    )
  }
  const sequenceHex = sequence
    .toString(HEX)
    .padStart(SEQUENCE_HEX_LENGTH, '0')
    .toUpperCase()
  return sequenceHex + accountIdHex(issuer)
}

/**
 * Compute the MPTokenIssuanceID of an MPT issuance.
 *
 * The 24-byte ID is the 32-bit sequence the creating
 * {@link MPTokenIssuanceCreate} consumed, followed by the 20-byte AccountID of
 * the issuer — so it is known before the transaction is submitted (after
 * `autofill` has assigned a `Sequence`), and it never changes.
 *
 * The sequence is the one the transaction *consumed*: its `Sequence`, or its
 * `TicketSequence` when the transaction was submitted with a ticket (in which
 * case `Sequence` is `0`). Pass the transaction and both cases are handled;
 * pass `issuer` and `sequence` explicitly when you only have the numbers.
 *
 * Feed the result to {@link hashMPTokenIssuance} / {@link hashMPToken} for the
 * ledger indexes, or to {@link fetchMPTokenIssuance} / {@link fetchMPToken} to
 * read the entries.
 *
 * @example
 * ```ts
 * const create = await client.autofill({ TransactionType: 'MPTokenIssuanceCreate', Account: issuer })
 * const mptIssuanceID = getMPTokenIssuanceID(create)
 * await client.submitAndWait(create, { wallet })
 * ```
 *
 * @param issuerOrTx - The issuer's classic or X-address, or the (autofilled)
 *   MPTokenIssuanceCreate transaction.
 * @param sequence - The sequence the create consumed (`TicketSequence ?? Sequence`).
 *   Required when the first argument is an address.
 * @returns The 48-character uppercase hex MPTokenIssuanceID.
 * @throws {ValidationError} When the sequence is missing or not a 32-bit
 *   unsigned integer, or the issuer is not a valid address.
 * @category Utilities
 */
export function getMPTokenIssuanceID(
  issuerOrTx: string | MPTokenIssuanceIDSource,
  sequence?: number,
): string {
  if (typeof issuerOrTx === 'string') {
    if (sequence === undefined) {
      throw new ValidationError(
        'getMPTokenIssuanceID: sequence is required when passing an issuer address',
      )
    }
    return deriveMPTokenIssuanceID(issuerOrTx, sequence)
  }
  const consumed = issuerOrTx.TicketSequence ?? issuerOrTx.Sequence
  if (consumed === undefined) {
    throw new ValidationError(
      'getMPTokenIssuanceID: transaction has neither Sequence nor TicketSequence (autofill it first)',
    )
  }
  return deriveMPTokenIssuanceID(issuerOrTx.Account, consumed)
}

/**
 * Split an MPTokenIssuanceID into the sequence and issuer it was built from.
 *
 * @param mptIssuanceID - The 24-byte hex MPTokenIssuanceID.
 * @returns The sequence the creating transaction consumed and the issuer's
 *   classic address.
 * @throws {ValidationError} When the input is not 48 hex characters.
 * @category Utilities
 */
export function parseMPTokenIssuanceID(mptIssuanceID: string): {
  sequence: number
  issuer: string
} {
  if (!MPT_ISSUANCE_ID_REGEX.test(mptIssuanceID)) {
    throw new ValidationError(
      `parseMPTokenIssuanceID: expected ${MPT_ISSUANCE_ID_LENGTH} hex characters, got ${mptIssuanceID}`,
    )
  }
  return {
    sequence: Number.parseInt(mptIssuanceID.slice(0, SEQUENCE_HEX_LENGTH), HEX),
    issuer: encodeAccountID(
      hexToBytes(mptIssuanceID.slice(SEQUENCE_HEX_LENGTH)),
    ),
  }
}

function issuanceIDFromCreatedNode(
  meta: TransactionMetadata,
): string | undefined {
  for (const node of meta.AffectedNodes) {
    if (
      isCreatedNode(node) &&
      node.CreatedNode.LedgerEntryType === 'MPTokenIssuance'
    ) {
      const { Issuer, Sequence } = node.CreatedNode.NewFields
      if (typeof Issuer === 'string' && typeof Sequence === 'number') {
        return deriveMPTokenIssuanceID(Issuer, Sequence)
      }
    }
  }
  return undefined
}

/**
 * Get the MPTokenIssuanceID of the issuance an `MPTokenIssuanceCreate`
 * transaction created, from the transaction's metadata.
 *
 * rippled's RPC layer adds a synthetic `mpt_issuance_id` to the metadata of a
 * *successful* create, and that is returned when present. Otherwise (metadata
 * decoded from binary, or from a server that does not add the field) the ID is
 * derived from the created `MPTokenIssuance` node's `Issuer` and `Sequence`.
 *
 * @param meta - Metadata from the response to submitting and waiting for an
 *   MPTokenIssuanceCreate transaction, or from a `tx` method call. JSON or
 *   binary (hex) form.
 * @returns The MPTokenIssuanceID, or `undefined` when the transaction did not
 *   succeed (no issuance was created).
 * @throws {TypeError} When `meta` is not transaction metadata.
 * @category Utilities
 */
export function getMPTokenIssuanceIDFromMeta(
  meta: TransactionMetadata | string | undefined,
): string | undefined {
  if (typeof meta !== 'string' && meta?.AffectedNodes === undefined) {
    throw new TypeError(`Unable to parse the parameter given to getMPTokenIssuanceIDFromMeta.
      'meta' must be the metadata from an MPTokenIssuanceCreate transaction. Received ${JSON.stringify(
        meta,
      )} instead.`)
  }

  const decodedMeta: TransactionMetadata =
    typeof meta === 'string'
      ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Meta is either metadata or serialized metadata.
        (decode(meta) as unknown as TransactionMetadata)
      : meta

  if (decodedMeta.TransactionResult !== 'tesSUCCESS') {
    return undefined
  }

  if (
    'mpt_issuance_id' in decodedMeta &&
    typeof decodedMeta.mpt_issuance_id === 'string'
  ) {
    return decodedMeta.mpt_issuance_id
  }

  return issuanceIDFromCreatedNode(decodedMeta)
}
