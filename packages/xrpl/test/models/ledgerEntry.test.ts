import { assert } from 'chai'

import type {
  LedgerEntry,
  LedgerEntryRequest,
  LedgerEntryResponse,
} from '../../src'

const SUBJECT = 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'
const ISSUER = 'rhsxKNyN99q6vyYCTHNTC1TqWCeHr7PNgp'
const OBJECT_ID =
  'A8B0E1F26ACD4D5E4D2F6D2A1E76F9C3CB28D8F8D8E1E8B3D1B6E0A6B7C8D9E0'
const MPT_ISSUANCE_ID = '000002A4E81F3DB81A22113984FCF242E1F0EFE3B646F413'

const mptEscrow: LedgerEntry.Escrow = {
  LedgerEntryType: 'Escrow',
  Account: SUBJECT,
  Destination: ISSUER,
  Amount: { mpt_issuance_id: MPT_ISSUANCE_ID, value: '7' },
  Flags: 0,
  OwnerNode: '0',
  DestinationNode: '0',
  IssuerNode: '0',
  PreviousTxnID:
    'F9A1BD8E4C5E2A9A1F7E2B4D5C6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A',
  PreviousTxnLgrSeq: 42,
  index: OBJECT_ID,
}

/**
 * Request- and response-shape checks for `ledger_entry`. These are mostly
 * compile-time assertions: a mistyped key or a missing field on the model
 * fails the suite before it runs.
 */
describe('ledger_entry request and response shapes', function () {
  it('credential lookup is keyed with credential_type', function () {
    const request: LedgerEntryRequest = {
      command: 'ledger_entry',
      credential: {
        subject: SUBJECT,
        issuer: ISSUER,
        credential_type: '4B5943',
      },
      ledger_index: 'validated',
    }

    assert.isObject(request.credential)
    if (typeof request.credential === 'object') {
      assert.equal(request.credential.credential_type, '4B5943')
      assert.notProperty(request.credential, 'credentialType')
    }
  })

  it('types the permissioned_domain, vault, oracle, nft_offer, loan and loan_broker lookups', function () {
    const requests: LedgerEntryRequest[] = [
      {
        command: 'ledger_entry',
        permissioned_domain: { account: ISSUER, seq: 5 },
      },
      { command: 'ledger_entry', permissioned_domain: OBJECT_ID },
      { command: 'ledger_entry', vault: { owner: ISSUER, seq: 6 } },
      { command: 'ledger_entry', vault: OBJECT_ID },
      {
        command: 'ledger_entry',
        oracle: { account: ISSUER, oracle_document_id: 1 },
      },
      { command: 'ledger_entry', oracle: OBJECT_ID },
      { command: 'ledger_entry', nft_offer: OBJECT_ID },
      {
        command: 'ledger_entry',
        loan: { loan_broker_id: OBJECT_ID, loan_seq: 2 },
      },
      { command: 'ledger_entry', loan: OBJECT_ID },
      { command: 'ledger_entry', loan_broker: { owner: ISSUER, seq: 7 } },
      { command: 'ledger_entry', loan_broker: OBJECT_ID },
    ]

    // The typed members must be the exact keys rippled parses.
    const lookupKeys = requests.map((request) =>
      Object.keys(request).filter((key) => key !== 'command'),
    )
    assert.deepEqual(lookupKeys, [
      ['permissioned_domain'],
      ['permissioned_domain'],
      ['vault'],
      ['vault'],
      ['oracle'],
      ['oracle'],
      ['nft_offer'],
      ['loan'],
      ['loan'],
      ['loan_broker'],
      ['loan_broker'],
    ])

    // Sub-fields are reachable without a cast.
    const [permissionedDomain] = requests
    if (typeof permissionedDomain.permissioned_domain === 'object') {
      assert.equal(permissionedDomain.permissioned_domain.account, ISSUER)
      assert.equal(permissionedDomain.permissioned_domain.seq, 5)
    }
    const oracle = requests[4]
    if (typeof oracle.oracle === 'object') {
      assert.equal(oracle.oracle.oracle_document_id, 1)
    }
    const loan = requests[7]
    if (typeof loan.loan === 'object') {
      assert.equal(loan.loan.loan_seq, 2)
    }
  })

  it('validated lookup result carries ledger_index and ledger_hash', function () {
    const response: LedgerEntryResponse<LedgerEntry.Escrow> = {
      id: 1,
      type: 'response',
      result: {
        index: OBJECT_ID,
        ledger_hash:
          '3C8D6E2A1F0B9C8D7E6F5A4B3C2D1E0F9A8B7C6D5E4F3A2B1C0D9E8F7A6B5C4D',
        ledger_index: 17,
        node: mptEscrow,
        validated: true,
      },
    }

    assert.equal(response.result.ledger_index, 17)
    assert.isString(response.result.ledger_hash)
    assert.isUndefined(response.result.ledger_current_index)
    assert.isTrue(response.result.validated)
  })

  it('current-ledger lookup result carries ledger_current_index', function () {
    const response: LedgerEntryResponse<LedgerEntry.Escrow> = {
      id: 2,
      type: 'response',
      result: {
        index: OBJECT_ID,
        ledger_current_index: 18,
        node: mptEscrow,
        validated: false,
      },
    }

    assert.equal(response.result.ledger_current_index, 18)
    assert.isUndefined(response.result.ledger_index)
    assert.isUndefined(response.result.ledger_hash)
  })

  it('Escrow node accepts an MPT Amount and a hex-string IssuerNode', function () {
    assert.isObject(mptEscrow.Amount)
    if (
      typeof mptEscrow.Amount === 'object' &&
      'mpt_issuance_id' in mptEscrow.Amount
    ) {
      assert.equal(mptEscrow.Amount.mpt_issuance_id, MPT_ISSUANCE_ID)
      assert.equal(mptEscrow.Amount.value, '7')
    }
    assert.strictEqual(mptEscrow.IssuerNode, '0')

    const xrpEscrow: LedgerEntry.Escrow = { ...mptEscrow, Amount: '1000000' }
    assert.strictEqual(xrpEscrow.Amount, '1000000')

    const iouEscrow: LedgerEntry.Escrow = {
      ...mptEscrow,
      Amount: { currency: 'USD', issuer: ISSUER, value: '1.5' },
    }
    assert.isObject(iouEscrow.Amount)
  })
})
