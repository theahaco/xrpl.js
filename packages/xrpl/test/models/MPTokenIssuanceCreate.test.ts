import { stringToHex } from '@xrplf/isomorphic/src/utils'
import { assert } from 'chai'

import {
  MPTokenIssuanceCreate,
  MPTokenIssuanceCreateFlags,
  MPTokenMetadata,
  ValidationError,
  convertImmutableFlagsToNumber,
} from '../../src'
import {
  MPTokenIssuanceCreateImmutableFlags,
  tifMPTokenIssuanceImmutableMask,
  validateMPTokenIssuanceCreate,
} from '../../src/models/transactions/MPTokenIssuanceCreate'
import {
  MAX_MPT_META_BYTE_LENGTH,
  MPT_META_WARNING_HEADER,
} from '../../src/models/utils/mptokenMetadata'
import { assertTxIsValid, assertTxValidationError } from '../testUtils'

const assertValid = (tx: any): void =>
  assertTxIsValid(tx, validateMPTokenIssuanceCreate)
const assertInvalid = (tx: any, message: string): void =>
  assertTxValidationError(tx, validateMPTokenIssuanceCreate, message)

/**
 * MPTokenIssuanceCreate Transaction Verification Testing.
 *
 * Providing runtime verification testing for each specific transaction type.
 */
describe('MPTokenIssuanceCreate', function () {
  it(`verifies valid MPTokenIssuanceCreate`, function () {
    const validMPTokenIssuanceCreate = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      // 0x7fffffffffffffff
      MaximumAmount: '9223372036854775807',
      AssetScale: 2,
      TransferFee: 1,
      Flags: MPTokenIssuanceCreateFlags.tfMPTCanTransfer,
      ImmutableFlags: MPTokenIssuanceCreateImmutableFlags.tifMPTTransferFee,
      MPTokenMetadata: stringToHex(`{
        "ticker": "TBILL",
        "name": "T-Bill Yield Token",
        "icon": "https://example.org/tbill-icon.png",
        "asset_class": "rwa",
        "asset_subclass": "treasury",
        "issuer_name": "Example Yield Co."
      }`),
    } as any

    assertValid(validMPTokenIssuanceCreate)
  })

  it(`verifies valid MPTokenIssuanceCreate w/ tfMPTCanHoldConfidentialBalance`, function () {
    assertValid({
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      Flags: MPTokenIssuanceCreateFlags.tfMPTCanHoldConfidentialBalance,
    } as any)

    assertValid({
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      Flags: { tfMPTCanHoldConfidentialBalance: true },
    } as any)
  })

  it(`throws w/ MPTokenMetadata being an empty string`, function () {
    const invalid = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      Flags: MPTokenIssuanceCreateFlags.tfMPTCanLock,
      MPTokenMetadata: '',
    } as any

    assertInvalid(
      invalid,
      `MPTokenIssuanceCreate: MPTokenMetadata (hex format) must be non-empty and no more than ${MAX_MPT_META_BYTE_LENGTH} bytes.`,
    )
  })

  it(`throws w/ MPTokenMetadata not in hex format`, function () {
    const invalid = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      Flags: MPTokenIssuanceCreateFlags.tfMPTCanLock,
      MPTokenMetadata: 'http://xrpl.org',
    } as any

    assertInvalid(
      invalid,
      `MPTokenIssuanceCreate: MPTokenMetadata (hex format) must be non-empty and no more than ${MAX_MPT_META_BYTE_LENGTH} bytes.`,
    )
  })

  it(`throws w/ Invalid MaximumAmount`, function () {
    let invalid = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MaximumAmount: '9223372036854775808',
    } as any

    assertInvalid(invalid, 'MPTokenIssuanceCreate: MaximumAmount out of range')

    invalid = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MaximumAmount: '-1',
    } as any

    assertInvalid(invalid, 'MPTokenIssuanceCreate: Invalid MaximumAmount')

    invalid = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MaximumAmount: '0x12',
    } as any

    assertInvalid(invalid, 'MPTokenIssuanceCreate: Invalid MaximumAmount')
  })

  it(`throws w/ Invalid TransferFee`, function () {
    let invalid = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      TransferFee: -1,
    } as any

    assertInvalid(
      invalid,
      'MPTokenIssuanceCreate: TransferFee must be between 0 and 50000',
    )

    invalid = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      TransferFee: 50001,
    } as any

    assertInvalid(
      invalid,
      'MPTokenIssuanceCreate: TransferFee must be between 0 and 50000',
    )

    invalid = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      TransferFee: 100,
    } as any

    assertInvalid(
      invalid,
      'MPTokenIssuanceCreate: TransferFee cannot be provided without enabling tfMPTCanTransfer flag',
    )

    invalid = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      TransferFee: 100,
      Flags: { tfMPTCanClawback: true },
    } as any

    assertInvalid(
      invalid,
      'MPTokenIssuanceCreate: TransferFee cannot be provided without enabling tfMPTCanTransfer flag',
    )
  })

  it(`throws w/ TransferFee and tfMPTCanHoldConfidentialBalance`, function () {
    // Confidential amounts are encrypted, so a transfer rate cannot apply;
    // rippled rejects this pairing with temBAD_TRANSFER_FEE.
    assertInvalid(
      {
        TransactionType: 'MPTokenIssuanceCreate',
        Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
        TransferFee: 100,
        // Distinct flag bits, so addition is equivalent to a bitwise OR.
        Flags:
          MPTokenIssuanceCreateFlags.tfMPTCanTransfer +
          MPTokenIssuanceCreateFlags.tfMPTCanHoldConfidentialBalance,
      } as any,
      'MPTokenIssuanceCreate: TransferFee cannot be provided together with the tfMPTCanHoldConfidentialBalance flag',
    )

    assertInvalid(
      {
        TransactionType: 'MPTokenIssuanceCreate',
        Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
        TransferFee: 100,
        Flags: {
          tfMPTCanTransfer: true,
          tfMPTCanHoldConfidentialBalance: true,
        },
      } as any,
      'MPTokenIssuanceCreate: TransferFee cannot be provided together with the tfMPTCanHoldConfidentialBalance flag',
    )
  })

  it(`throws w/ invalid ImmutableFlags value`, async () => {
    const invalid = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      ImmutableFlags: tifMPTokenIssuanceImmutableMask,
    } as any

    assertInvalid(
      invalid,
      'MPTokenIssuanceCreate: Invalid ImmutableFlags value',
    )
  })

  it(`verifies valid MPTokenIssuanceCreate w/ ImmutableFlags in interface form`, function () {
    // Typed (not `as any`) so the interface form is also checked at compile time.
    const tx: MPTokenIssuanceCreate = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      Flags: { tfMPTCanTrade: true, tfMPTCanEscrow: true },
      ImmutableFlags: { tifMPTCanTrade: true, tifMPTCanEscrow: true },
    }

    assertValid(tx)
  })

  it(`throws w/ unknown flag name in ImmutableFlags interface form`, function () {
    const invalid = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      // tfMPTCanTrade is a Flags name, not a tif* ImmutableFlags name.
      ImmutableFlags: { tfMPTCanTrade: true },
    } as any

    assertInvalid(invalid, 'Invalid ImmutableFlags flag tfMPTCanTrade.')
  })

  it(`throws w/ ImmutableFlags interface form that sets no flag`, function () {
    // {} and all-false convert to 0, which rippled rejects like an explicit 0.
    assertInvalid(
      {
        TransactionType: 'MPTokenIssuanceCreate',
        Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
        ImmutableFlags: {},
      } as any,
      'MPTokenIssuanceCreate: Invalid ImmutableFlags value',
    )
    assertInvalid(
      {
        TransactionType: 'MPTokenIssuanceCreate',
        Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
        ImmutableFlags: { tifMPTCanTrade: false },
      } as any,
      'MPTokenIssuanceCreate: Invalid ImmutableFlags value',
    )
  })

  it(`throws w/ ImmutableFlags explicitly set to 0`, async () => {
    // rippled rejects a present-but-zero ImmutableFlags with temINVALID_FLAG.
    const invalid = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      ImmutableFlags: 0,
    } as any

    assertInvalid(
      invalid,
      'MPTokenIssuanceCreate: Invalid ImmutableFlags value',
    )
  })

  it(`throws with Zero MaximumAmount`, function () {
    const invalid = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MaximumAmount: '0',
    } as any

    assertInvalid(invalid, 'MPTokenIssuanceCreate: MaximumAmount out of range')
  })

  it(`throws with Zero DomainID`, function () {
    const invalid = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      DomainID: '0'.repeat(64),
    } as any

    assertInvalid(invalid, 'MPTokenIssuanceCreate: invalid field DomainID')
  })

  it(`throws with DomainID and tfMPTRequireAuth flag not set`, function () {
    const invalid = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      DomainID: '1'.repeat(64),
      Flags: 0,
    } as any

    assertInvalid(
      invalid,
      'MPTokenIssuanceCreate: Cannot set DomainID unless tfMPTRequireAuth flag is set.',
    )
  })

  it(`throws with invalid type of DomainID`, function () {
    const invalid = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      DomainID: 1,
    } as any

    assertInvalid(invalid, 'MPTokenIssuanceCreate: invalid field DomainID')
  })
})

/**
 * Test console warning is logged while validating MPTokenIssuanceCreate for MPTokenMetadata field.
 */
/* eslint-disable no-console -- Require to test console warnings  */
describe('MPTokenMetadata warnings', function () {
  beforeEach(() => {
    jest.spyOn(console, 'warn')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it(`logs console warning`, function () {
    const mptMetaData: MPTokenMetadata = {
      ticker: 'TBILL',
      name: 'T-Bill Token',
      icon: 'http://example.com/icon.png',
      asset_class: 'rwa',
      asset_subclass: 'treasury',
      issuer_name: 'Issuer',
      uris: ['apple'],
    } as unknown as MPTokenMetadata
    const tx = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: 'rWYkbWkCeg8dP6rXALnjgZSjjLyih5NXm',
      MPTokenMetadata: stringToHex(JSON.stringify(mptMetaData)),
    }

    assertValid(tx)

    const expectedMessage = [
      MPT_META_WARNING_HEADER,
      '- uris/us: should be an array of objects each with uri/u, category/c, and title/t properties.',
    ].join('\n')

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(expectedMessage),
    )
  })
})
/* eslint-enable no-console  */

describe('convertImmutableFlagsToNumber', function () {
  it('returns a numeric bitmask unchanged', function () {
    assert.strictEqual(convertImmutableFlagsToNumber(0x18), 0x18)
    assert.strictEqual(convertImmutableFlagsToNumber(0), 0)
  })

  it('converts the interface form to its bitmask', function () {
    assert.strictEqual(
      convertImmutableFlagsToNumber({
        tifMPTCanTrade: true,
        tifMPTCanEscrow: true,
      }),
      0x18,
    )
    assert.strictEqual(
      convertImmutableFlagsToNumber({
        tifMPTCanLock: true,
        tifMPTRequireAuth: true,
        tifMPTCanEscrow: true,
        tifMPTCanTrade: true,
        tifMPTCanTransfer: true,
        tifMPTCanClawback: true,
        tifMPTCanHoldConfidentialBalance: true,
        tifMPTMetadata: true,
        tifMPTTransferFee: true,
      }),
      // eslint-disable-next-line no-bitwise -- the mask is the complement of every valid bit
      ~tifMPTokenIssuanceImmutableMask,
    )
  })

  it('ignores flags set to false and returns 0 for an empty map', function () {
    assert.strictEqual(
      convertImmutableFlagsToNumber({
        tifMPTMetadata: true,
        tifMPTTransferFee: false,
      }),
      MPTokenIssuanceCreateImmutableFlags.tifMPTMetadata,
    )
    assert.strictEqual(convertImmutableFlagsToNumber({}), 0)
  })

  it('throws on a key that is not a tif* flag', function () {
    assert.throws(
      () => convertImmutableFlagsToNumber({ tifBogus: true } as any),
      ValidationError,
      'Invalid ImmutableFlags flag tifBogus.',
    )
    // Numeric enum reverse mappings (e.g. "2" -> "tifMPTCanLock") are not flags.
    assert.throws(
      () => convertImmutableFlagsToNumber({ 2: true } as any),
      ValidationError,
      'Invalid ImmutableFlags flag 2.',
    )
  })
})
