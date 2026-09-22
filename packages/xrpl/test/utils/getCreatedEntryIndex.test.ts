import { assert } from 'chai'

import { getCreatedEntryIndex } from '../../src'
import type { TransactionMetadata } from '../../src/models/transactions/metadata'

const DOMAIN_INDEX =
  'A8B4C3F210EE8DFF53484376A2E749E5E6B8BC2B65E6326C614002994AF03B27'
const OWNER = 'rLnZAb1b9e1w9BfmuPUqyWjhWtWTbMEVUu'

/**
 * Metadata of a PermissionedDomainSet that created a domain, as captured from a
 * standalone rippled.
 *
 * @returns The metadata.
 */
function domainSetMeta(): TransactionMetadata {
  return {
    AffectedNodes: [
      {
        ModifiedNode: {
          LedgerEntryType: 'DirectoryNode',
          LedgerIndex:
            '05A181AB8548C3F500CE2608829715C91618175C63935DB925C963C1D29D408B',
          FinalFields: { Flags: 0, Owner: OWNER },
        },
      },
      {
        CreatedNode: {
          LedgerEntryType: 'PermissionedDomain',
          LedgerIndex: DOMAIN_INDEX,
          NewFields: { Owner: OWNER, Sequence: 7 },
        },
      },
    ],
    TransactionIndex: 0,
    TransactionResult: 'tesSUCCESS',
  } as unknown as TransactionMetadata
}

describe('getCreatedEntryIndex', function () {
  it('returns the index of the created entry of the requested type', function () {
    assert.equal(
      getCreatedEntryIndex(domainSetMeta(), 'PermissionedDomain'),
      DOMAIN_INDEX,
    )
  })

  it('returns undefined when no entry of that type was created', function () {
    assert.isUndefined(getCreatedEntryIndex(domainSetMeta(), 'Credential'))
  })

  it('ignores modified nodes of the requested type', function () {
    assert.isUndefined(getCreatedEntryIndex(domainSetMeta(), 'DirectoryNode'))
  })

  it('throws when given something that is not metadata', function () {
    assert.throws(
      () =>
        getCreatedEntryIndex(
          { hash: 'abc' } as unknown as TransactionMetadata,
          'PermissionedDomain',
        ),
      TypeError,
    )
  })
})
