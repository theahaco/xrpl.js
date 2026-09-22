import { encode } from '../src'

/**
 * Regression tests for the "same object, different bytes" family of codec
 * bugs: odd-length hex, empty IDs/accounts/issuers, and per-field errors
 * that used to surface without the field name.
 */
const ACCOUNT = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh'
const ISSUANCE_ID = '00000001A407AF5856CCF3C42619DAA925813FC955C72983'

const common = {
  Account: ACCOUNT,
  Fee: '10',
  Sequence: 1,
  SigningPubKey: '',
}

describe('encode() rejects odd-length hex instead of truncating it', () => {
  it('CredentialType', () => {
    expect(() =>
      encode({
        ...common,
        TransactionType: 'CredentialCreate',
        Subject: ACCOUNT,
        CredentialType: 'ABC',
      }),
    ).toThrow(new Error('CredentialType: Invalid hex string: odd length (3)'))
  })

  it('MPTokenMetadata', () => {
    expect(() =>
      encode({
        ...common,
        TransactionType: 'MPTokenIssuanceCreate',
        MPTokenMetadata: '7B7D0',
      }),
    ).toThrow(new Error('MPTokenMetadata: Invalid hex string: odd length (5)'))
  })

  it('a 49-character MPTokenIssuanceID (was accepted and shifted)', () => {
    expect(() =>
      encode({
        ...common,
        TransactionType: 'MPTokenIssuanceSet',
        MPTokenIssuanceID: `F${ISSUANCE_ID}`,
      }),
    ).toThrow(
      new Error('MPTokenIssuanceID: Invalid hex string: odd length (49)'),
    )
  })

  it('a 65-character CredentialID inside an STArray', () => {
    expect(() =>
      encode({
        ...common,
        TransactionType: 'CredentialAccept',
        Issuer: ACCOUNT,
        CredentialType: 'ABCD',
        CredentialIDs: [`F${'C'.repeat(64)}`],
      }),
    ).toThrow('CredentialIDs: Invalid hex string: odd length (65)')
  })

  it('names the nested path for MemoData', () => {
    expect(() =>
      encode({
        ...common,
        TransactionType: 'AccountSet',
        Memos: [{ Memo: { MemoData: 'ABC' } }],
      }),
    ).toThrow(
      new Error('Memos: Memo: MemoData: Invalid hex string: odd length (3)'),
    )
  })
})

describe('encode() rejects empty strings instead of substituting zero values', () => {
  it('MPTokenIssuanceID', () => {
    expect(() =>
      encode({
        ...common,
        TransactionType: 'MPTokenIssuanceSet',
        MPTokenIssuanceID: '',
      }),
    ).toThrow(new Error('MPTokenIssuanceID: Invalid Hash length 0'))
  })

  it('mpt_issuance_id inside an Amount', () => {
    expect(() =>
      encode({
        ...common,
        TransactionType: 'Payment',
        Destination: ACCOUNT,
        Amount: { mpt_issuance_id: '', value: '1' },
      }),
    ).toThrow(new Error('Amount: Invalid Hash length 0'))
  })

  it('Account', () => {
    expect(() =>
      encode({ ...common, TransactionType: 'AccountSet', Account: '' }),
    ).toThrow(
      new Error(
        'Account: Cannot construct AccountID from an empty string (use rrrrrrrrrrrrrrrrrrrrrhoLvTp for ACCOUNT_ZERO)',
      ),
    )
  })

  it('Subject', () => {
    expect(() =>
      encode({
        ...common,
        TransactionType: 'CredentialCreate',
        Subject: '',
        CredentialType: 'ABCD',
      }),
    ).toThrow('Subject: Cannot construct AccountID from an empty string')
  })

  it('Asset issuer', () => {
    expect(() =>
      encode({
        ...common,
        TransactionType: 'VaultCreate',
        Asset: { currency: 'USD', issuer: '' },
      }),
    ).toThrow(
      new Error('Asset: Issue: issuer is required for non-XRP currency USD'),
    )
  })
})

describe('encode() names the field in codec errors', () => {
  it('AssetScale out of range names UInt8, not Function', () => {
    expect(() =>
      encode({
        ...common,
        TransactionType: 'MPTokenIssuanceCreate',
        AssetScale: 256,
      }),
    ).toThrow(
      new Error('AssetScale: Invalid UInt8: 256 must be >= 0 and <= 255'),
    )
  })

  it('MaximumAmount overflow reports the decimal once', () => {
    expect(() =>
      encode({
        ...common,
        TransactionType: 'MPTokenIssuanceCreate',
        MaximumAmount: '18446744073709551616',
      }),
    ).toThrow(new Error('MaximumAmount 18446744073709551616 exceeds 2^64-1'))
  })

  it('null MPTokenIssuanceID', () => {
    expect(() =>
      encode({
        ...common,
        TransactionType: 'MPTokenIssuanceSet',
        MPTokenIssuanceID: null,
      }),
    ).toThrow(
      new Error('MPTokenIssuanceID: Cannot construct Hash from given value'),
    )
  })

  it('non-string MPT Amount value', () => {
    expect(() =>
      encode({
        ...common,
        TransactionType: 'Payment',
        Destination: ACCOUNT,
        Amount: { mpt_issuance_id: ISSUANCE_ID, value: 5 },
      }),
    ).toThrow(
      new Error(
        'Amount: MPT amount value must be a decimal string, got number',
      ),
    )
  })

  it('still encodes a valid MPTokenIssuanceCreate', () => {
    expect(() =>
      encode({
        ...common,
        TransactionType: 'MPTokenIssuanceCreate',
        AssetScale: 2,
        MaximumAmount: '18446744073709551615',
        MPTokenMetadata: '7B7D',
      }),
    ).not.toThrow()
  })
})
