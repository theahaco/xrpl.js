import { decode } from 'ripple-binary-codec'

import type { LedgerEntry } from '../models/ledger'
import {
  isCreatedNode,
  TransactionMetadata,
} from '../models/transactions/metadata'

/**
 * Get the ledger index of an entry a transaction created, from the
 * transaction's metadata.
 *
 * This is the general way to obtain the ID of an object that has no synthetic
 * ID in its metadata — a `PermissionedDomain`'s `DomainID` from the
 * `PermissionedDomainSet` that created it, a `Credential`'s `CredentialID`
 * from its `CredentialCreate`, and so on — without listing `account_objects`
 * and guessing which entry is the new one. Where the ID can be computed
 * without metadata, use the matching hash helper instead
 * ({@link hashPermissionedDomain}, {@link hashCredential},
 * {@link hashMPTokenIssuance}).
 *
 * @example
 * ```ts
 * const response = await client.submitAndWait(permissionedDomainSet, { wallet })
 * const domainID = getCreatedEntryIndex(response.result.meta, 'PermissionedDomain')
 * ```
 *
 * @param meta - Metadata from the response to submitting and waiting for the
 *   transaction, or from a `tx` method call. JSON or binary (hex) form.
 * @param ledgerEntryType - The `LedgerEntryType` of the created entry.
 * @returns The `LedgerIndex` of the first `CreatedNode` of that type, or
 *   `undefined` when the transaction created no such entry (including when it
 *   did not succeed).
 * @throws {TypeError} When `meta` is not transaction metadata.
 * @category Utilities
 */
export default function getCreatedEntryIndex(
  meta: TransactionMetadata | string | undefined,
  ledgerEntryType: LedgerEntry['LedgerEntryType'],
): string | undefined {
  if (typeof meta !== 'string' && meta?.AffectedNodes === undefined) {
    throw new TypeError(`Unable to parse the parameter given to getCreatedEntryIndex.
      'meta' must be transaction metadata. Received ${JSON.stringify(
        meta,
      )} instead.`)
  }

  const decodedMeta: TransactionMetadata =
    typeof meta === 'string'
      ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Meta is either metadata or serialized metadata.
        (decode(meta) as unknown as TransactionMetadata)
      : meta

  const created = decodedMeta.AffectedNodes.find(
    (node) =>
      isCreatedNode(node) &&
      node.CreatedNode.LedgerEntryType === ledgerEntryType,
  )
  return created && isCreatedNode(created)
    ? created.CreatedNode.LedgerIndex
    : undefined
}
