import { assert } from 'chai'

import {
  ValidationError,
  getMPTokenIssuanceID,
  getMPTokenIssuanceIDFromMeta,
  parseMPTokenIssuanceID,
} from '../../src'
import type { MPTokenIssuanceCreate } from '../../src'
import type { TransactionMetadata } from '../../src/models/transactions/metadata'

const ISSUER = 'rLnZAb1b9e1w9BfmuPUqyWjhWtWTbMEVUu'
const SEQUENCE_3_ID = '00000003D1478D4517822D2618230F4D55C1F40656D40D60'
const TICKET_5_ID = '00000005D1478D4517822D2618230F4D55C1F40656D40D60'
const ISSUANCE_INDEX =
  '59C03A8F20A18499FE82A119148CDADD5F06B9A9F0327451575D09FCFE6E509B'

/**
 * Metadata of a successful MPTokenIssuanceCreate, as captured from a standalone
 * rippled. `mpt_issuance_id` is the synthetic field the RPC layer adds.
 *
 * @returns The metadata.
 */
function createMeta(): TransactionMetadata {
  return {
    AffectedNodes: [
      {
        CreatedNode: {
          LedgerEntryType: 'MPTokenIssuance',
          LedgerIndex: ISSUANCE_INDEX,
          NewFields: {
            AssetScale: 2,
            Flags: 98,
            Issuer: ISSUER,
            MaximumAmount: '1000000',
            Sequence: 3,
            TransferFee: 1000,
          },
        },
      },
    ],
    TransactionIndex: 0,
    TransactionResult: 'tesSUCCESS',
    mpt_issuance_id: SEQUENCE_3_ID,
  } as unknown as TransactionMetadata
}

describe('getMPTokenIssuanceID', function () {
  it('derives the ID from an issuer and a sequence', function () {
    assert.equal(getMPTokenIssuanceID(ISSUER, 3), SEQUENCE_3_ID)
  })

  it('derives the ID from an autofilled transaction', function () {
    const tx: MPTokenIssuanceCreate = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: ISSUER,
      Sequence: 3,
    }

    assert.equal(getMPTokenIssuanceID(tx), SEQUENCE_3_ID)
  })

  it('uses TicketSequence when the create consumed a ticket', function () {
    const tx: MPTokenIssuanceCreate = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: ISSUER,
      Sequence: 0,
      TicketSequence: 5,
    }

    assert.equal(getMPTokenIssuanceID(tx), TICKET_5_ID)
  })

  it('accepts an X-address for the issuer', function () {
    const xAddress = 'XVX5cANgF2N8X4obwDns2FaGGtVFPLk2m8sg1z3F3XrzFW1'

    assert.equal(getMPTokenIssuanceID(xAddress, 3), SEQUENCE_3_ID)
  })

  it('throws when the transaction has no sequence', function () {
    assert.throws(
      () =>
        getMPTokenIssuanceID({
          Account: ISSUER,
        } as unknown as MPTokenIssuanceCreate),
      ValidationError,
      'neither Sequence nor TicketSequence',
    )
  })

  it('throws when the sequence is not a uint32', function () {
    assert.throws(
      () => getMPTokenIssuanceID(ISSUER, -1),
      ValidationError,
      '32-bit unsigned integer',
    )
    assert.throws(
      () => getMPTokenIssuanceID(ISSUER, 2 ** 32),
      ValidationError,
      '32-bit unsigned integer',
    )
  })
})

describe('parseMPTokenIssuanceID', function () {
  it('splits an ID back into its sequence and issuer', function () {
    assert.deepEqual(parseMPTokenIssuanceID(SEQUENCE_3_ID), {
      sequence: 3,
      issuer: ISSUER,
    })
  })

  it('round-trips a ticketed ID', function () {
    const { sequence, issuer } = parseMPTokenIssuanceID(TICKET_5_ID)

    assert.equal(getMPTokenIssuanceID(issuer, sequence), TICKET_5_ID)
  })

  it('throws on a malformed ID', function () {
    assert.throws(
      () => parseMPTokenIssuanceID('DEADBEEF'),
      ValidationError,
      'expected 48 hex characters',
    )
  })
})

describe('getMPTokenIssuanceIDFromMeta', function () {
  it('returns the synthetic mpt_issuance_id when present', function () {
    assert.equal(getMPTokenIssuanceIDFromMeta(createMeta()), SEQUENCE_3_ID)
  })

  it('derives the ID when the metadata has no synthetic field', function () {
    const meta = createMeta()
    // eslint-disable-next-line @typescript-eslint/dot-notation -- removing the synthetic field
    delete (meta as unknown as Record<string, unknown>)['mpt_issuance_id']

    assert.equal(getMPTokenIssuanceIDFromMeta(meta), SEQUENCE_3_ID)
  })

  it('returns undefined when the transaction failed', function () {
    const meta = createMeta()

    meta.TransactionResult = 'tecNO_PERMISSION'

    assert.isUndefined(getMPTokenIssuanceIDFromMeta(meta))
  })

  it('throws when given something that is not metadata', function () {
    assert.throws(
      () =>
        getMPTokenIssuanceIDFromMeta({
          hash: 'abc',
        } as unknown as TransactionMetadata),
      TypeError,
    )
  })
})
