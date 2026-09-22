import { assert } from 'chai'

import { ValidationError } from '../../src'
import {
  isIssuedCurrencyAmount,
  isMPTAmount,
  isMPTokenIssuanceID,
  isMPTValue,
  isUInt8,
  isUInt16,
  isUInt32,
  tfUniversal,
  validateFlagsMask,
} from '../../src/models/transactions/common'

const MPT_ID = '000004C463C52827307480341125DA0577DEFC38405B0E3E'

describe('MPT field guards', function () {
  describe('isMPTokenIssuanceID', function () {
    it('accepts 48 hex characters in either case', function () {
      assert.isTrue(isMPTokenIssuanceID(MPT_ID))
      assert.isTrue(isMPTokenIssuanceID(MPT_ID.toLowerCase()))
    })

    it('rejects anything that is not 48 hex characters', function () {
      for (const bad of [
        MPT_ID.slice(1),
        `${MPT_ID}0`,
        'XY'.repeat(24),
        '',
        12,
        null,
        undefined,
        { MPT_ID },
      ]) {
        assert.isFalse(isMPTokenIssuanceID(bad), JSON.stringify(bad))
      }
    })
  })

  describe('isMPTValue', function () {
    it('accepts canonical decimal integers from 0 to 2^63 - 1', function () {
      for (const good of ['0', '1', '10', '9223372036854775807']) {
        assert.isTrue(isMPTValue(good), good)
      }
    })

    it('rejects non-canonical, signed, fractional, or out-of-range strings', function () {
      for (const bad of [
        '-1',
        '1.5',
        '1e2',
        '+1',
        '0x10',
        '',
        ' 1',
        '1 ',
        '007',
        '-0',
        '9223372036854775808',
        10,
        10n,
        null,
      ]) {
        assert.isFalse(isMPTValue(bad), String(bad))
      }
    })
  })

  describe('isMPTAmount', function () {
    it('accepts a well-formed MPTAmount', function () {
      assert.isTrue(isMPTAmount({ mpt_issuance_id: MPT_ID, value: '10' }))
    })

    it('ignores keys whose value is undefined', function () {
      assert.isTrue(
        isMPTAmount({
          mpt_issuance_id: MPT_ID,
          value: '10',
          currency: undefined,
          issuer: undefined,
        }),
      )
    })

    it('rejects extra defined keys, bad IDs, and bad values', function () {
      assert.isFalse(
        isMPTAmount({ mpt_issuance_id: MPT_ID, value: '10', currency: 'USD' }),
      )
      assert.isFalse(isMPTAmount({ mpt_issuance_id: 'ABCD', value: '10' }))
      assert.isFalse(isMPTAmount({ mpt_issuance_id: MPT_ID, value: '1.5' }))
      assert.isFalse(isMPTAmount({ mpt_issuance_id: MPT_ID }))
      assert.isFalse(isMPTAmount({ value: '10' }))
      assert.isFalse(isMPTAmount('10'))
    })
  })

  describe('isIssuedCurrencyAmount', function () {
    const iou = {
      currency: 'USD',
      issuer: 'rfkE1aSy9G8Upk4JssnwBxhEv5p4mn2KTy',
      value: '10',
    }

    it('ignores keys whose value is undefined', function () {
      assert.isTrue(
        isIssuedCurrencyAmount({ ...iou, mpt_issuance_id: undefined }),
      )
    })

    it('still rejects extra defined keys', function () {
      assert.isFalse(
        isIssuedCurrencyAmount({ ...iou, mpt_issuance_id: MPT_ID }),
      )
    })
  })

  describe('isUInt8 / isUInt16 / isUInt32', function () {
    it('accept integers within range', function () {
      assert.isTrue(isUInt8(0))
      assert.isTrue(isUInt8(255))
      assert.isTrue(isUInt16(65535))
      assert.isTrue(isUInt32(4294967295))
    })

    it('reject negatives, fractions, NaN, out-of-range, and non-numbers', function () {
      assert.isFalse(isUInt8(256))
      assert.isFalse(isUInt8(-1))
      assert.isFalse(isUInt8(1.5))
      assert.isFalse(isUInt8(Number.NaN))
      assert.isFalse(isUInt8('1'))
      assert.isFalse(isUInt16(65536))
      assert.isFalse(isUInt32(4294967296))
    })
  })

  describe('validateFlagsMask', function () {
    /* eslint-disable no-bitwise -- masks are bitwise by nature */
    const mask = ~(tfUniversal | 0x1)

    it('accepts flags within the mask, including the universal bits', function () {
      for (const flags of [undefined, 0, 0x1, 0x80000000, 0x40000000 | 0x1]) {
        assert.doesNotThrow(() =>
          validateFlagsMask({ TransactionType: 'Test', Flags: flags }, mask),
        )
      }
    })

    it('leaves object-form flags to convertTxFlagsToNumber', function () {
      assert.doesNotThrow(() =>
        validateFlagsMask(
          { TransactionType: 'Test', Flags: { tfAnything: true } },
          mask,
        ),
      )
    })

    it('rejects bits outside the mask and non-uint32 values', function () {
      for (const flags of [0x2, 0x1 | 0x2, -1, 1.5, 2 ** 32, Number.NaN]) {
        assert.throws(
          () =>
            validateFlagsMask({ TransactionType: 'Test', Flags: flags }, mask),
          ValidationError,
          'Test: invalid Flags',
        )
      }
    })
    /* eslint-enable no-bitwise */
  })
})
