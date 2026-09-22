/* eslint-disable no-bitwise -- flags require bitwise operations */
import { assert } from 'chai'

import {
  Credential,
  CredentialFlags,
  LedgerEntry,
  LedgerEntryFilter,
  MPToken,
  MPTokenFlags,
  MPTokenIssuance,
  parseCredentialFlags,
  parseMPTokenFlags,
} from '../../src'

/**
 * Widen a concrete entry to the union the way an RPC response does, so the
 * tests below exercise narrowing rather than assignment-based inference.
 *
 * @param entry - Any ledger entry.
 * @returns The same entry typed as the `LedgerEntry` union.
 */
function asLedgerEntry(
  entry: LedgerEntry.LedgerEntry,
): LedgerEntry.LedgerEntry {
  return entry
}

/**
 * Compile-time checks that the MPT and Credential ledger-entry types match
 * the JSON rippled actually returns, that they are members of the
 * `LedgerEntry` union, and that they are importable from the package root.
 */
describe('Ledger entry types', function () {
  // `ledger_entry` + `mptoken` for a holder that has only authorized (no
  // balance yet): rippled omits the default-valued `MPTAmount`.
  const freshMPToken: MPToken = {
    Account: 'rJSAsZm9mrs7kdAxfswswBimT8DKgwWWwT',
    Flags: 0,
    LedgerEntryType: 'MPToken',
    MPTokenIssuanceID: '0000000CB3120458230058B528D813A6FAAE0C01743E7453',
    OwnerNode: '0',
    PreviousTxnID:
      'FF8964708994E4868056B4E40B2651D972FE8235F1EBDB3BC8E5B4921887876C',
    PreviousTxnLgrSeq: 22,
    index: '3E0EF1A38D33CECF97A8510C45CE6027632A00FFCEEC3A33DE4D5DC737332F20',
  }

  // The same entry once funded, locked by the issuer and authorized.
  const fundedMPToken: MPToken = {
    ...freshMPToken,
    MPTAmount: '100',
    Flags: MPTokenFlags.lsfMPTLocked | MPTokenFlags.lsfMPTAuthorized,
  }

  // `ledger_entry` + `mpt_issuance`: `mpt_issuance_id` is injected by rippled.
  const issuance: MPTokenIssuance = {
    Flags: 0,
    Issuer: 'rJSAsZm9mrs7kdAxfswswBimT8DKgwWWwT',
    LedgerEntryType: 'MPTokenIssuance',
    OutstandingAmount: '0',
    OwnerNode: '0',
    PreviousTxnID:
      'FF8964708994E4868056B4E40B2651D972FE8235F1EBDB3BC8E5B4921887876C',
    PreviousTxnLgrSeq: 21,
    Sequence: 7,
    index: '910ED7E8D1ECC5687209DB58B66CC76E282398BDACA4F5E3C263531E90B775CC',
    mpt_issuance_id: '000000077EEF664B7A629066730123E42508AA854744FFE7',
  }

  // A Credential after CredentialAccept: `Flags` is a plain number, 0x00010000.
  const acceptedCredential: Credential = {
    CredentialType: '6D795F63726564656E7469616C',
    Flags: 65536,
    Issuer: 'rJSAsZm9mrs7kdAxfswswBimT8DKgwWWwT',
    IssuerNode: '0',
    LedgerEntryType: 'Credential',
    PreviousTxnID:
      'FF8964708994E4868056B4E40B2651D972FE8235F1EBDB3BC8E5B4921887876C',
    PreviousTxnLgrSeq: 23,
    Subject: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
    SubjectNode: '0',
    index: '3E0EF1A38D33CECF97A8510C45CE6027632A00FFCEEC3A33DE4D5DC737332F20',
  }

  it('MPToken narrows from the LedgerEntry union', function () {
    const entry = asLedgerEntry(fundedMPToken)
    assert(entry.LedgerEntryType === 'MPToken')
    assert.equal(entry.Account, 'rJSAsZm9mrs7kdAxfswswBimT8DKgwWWwT')
    assert.equal(entry.MPTAmount, '100')

    // Type-level: the union member for 'MPToken' is exactly `MPToken`.
    const narrowed: Extract<
      LedgerEntry.LedgerEntry,
      { LedgerEntryType: 'MPToken' }
    > = freshMPToken
    const roundTrip: MPToken = narrowed
    assert.isUndefined(roundTrip.MPTAmount)
  })

  it('MPTokenIssuance carries the injected mpt_issuance_id', function () {
    const entry = asLedgerEntry(issuance)
    assert(entry.LedgerEntryType === 'MPTokenIssuance')
    assert.equal(
      entry.mpt_issuance_id,
      '000000077EEF664B7A629066730123E42508AA854744FFE7',
    )
  })

  it('every LedgerEntryFilter has a matching LedgerEntry union member', function () {
    // Fails to compile if a filter has no union member with that LedgerEntryType.
    const filterToType: Record<
      LedgerEntryFilter,
      LedgerEntry.LedgerEntry['LedgerEntryType']
    > = {
      account: 'AccountRoot',
      amendments: 'Amendments',
      amm: 'AMM',
      bridge: 'Bridge',
      check: 'Check',
      credential: 'Credential',
      delegate: 'Delegate',
      deposit_preauth: 'DepositPreauth',
      did: 'DID',
      directory: 'DirectoryNode',
      escrow: 'Escrow',
      fee: 'FeeSettings',
      hashes: 'LedgerHashes',
      loan: 'Loan',
      loan_broker: 'LoanBroker',
      mpt_issuance: 'MPTokenIssuance',
      mptoken: 'MPToken',
      nft_offer: 'NFTokenOffer',
      nft_page: 'NFTokenPage',
      offer: 'Offer',
      oracle: 'Oracle',
      payment_channel: 'PayChannel',
      permissioned_domain: 'PermissionedDomain',
      signer_list: 'SignerList',
      sponsorship: 'Sponsorship',
      state: 'RippleState',
      ticket: 'Ticket',
      vault: 'Vault',
      xchain_owned_create_account_claim_id: 'XChainOwnedCreateAccountClaimID',
      xchain_owned_claim_id: 'XChainOwnedClaimID',
    }
    assert.equal(filterToType.mptoken, 'MPToken')
  })

  describe('parseMPTokenFlags', function () {
    it('reads lsfMPTLocked and lsfMPTAuthorized', function () {
      assert.equal(MPTokenFlags.lsfMPTLocked, 0x00000001)
      assert.equal(MPTokenFlags.lsfMPTAuthorized, 0x00000002)
      assert.deepEqual(parseMPTokenFlags(3), {
        lsfMPTLocked: true,
        lsfMPTAuthorized: true,
      })
      assert.deepEqual(parseMPTokenFlags(fundedMPToken.Flags), {
        lsfMPTLocked: true,
        lsfMPTAuthorized: true,
      })
      assert.deepEqual(parseMPTokenFlags(1), { lsfMPTLocked: true })
      assert.deepEqual(parseMPTokenFlags(2), { lsfMPTAuthorized: true })
    })

    it('returns an empty interface for 0', function () {
      assert.deepEqual(parseMPTokenFlags(freshMPToken.Flags), {})
    })
  })

  describe('parseCredentialFlags', function () {
    it('reads lsfAccepted', function () {
      assert.equal(CredentialFlags.lsfAccepted, 0x00010000)
      assert.deepEqual(parseCredentialFlags(0x10000), { lsfAccepted: true })
      assert.deepEqual(parseCredentialFlags(acceptedCredential.Flags), {
        lsfAccepted: true,
      })
      assert.isTrue(
        (acceptedCredential.Flags & CredentialFlags.lsfAccepted) !== 0,
      )
    })

    it('returns an empty interface for 0', function () {
      assert.deepEqual(parseCredentialFlags(0), {})
    })
  })
})
