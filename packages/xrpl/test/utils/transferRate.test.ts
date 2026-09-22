import { assert } from 'chai'

import {
  MAX_MPT_TRANSFER_FEE,
  MAX_TRANSFER_FEE,
  ValidationError,
  mptTransferFeeToPercent,
  percentToMPTTransferFee,
  percentToTransferRate,
  decimalToTransferRate,
  transferRateToDecimal,
} from '../../src'

describe('TransferRate utils', function () {
  it('converts 1 percent to valid TransferRate', function () {
    const billionths = percentToTransferRate('1%')

    assert.equal(billionths, 1010000000)
  })

  it('converts .01 percent to valid TransferRate', function () {
    assert.equal(decimalToTransferRate('.01'), 1010000000)
    assert.equal(transferRateToDecimal(1010000000), '0.01')
  })

  it('Throws when TransferRate < 0%', function () {
    assert.throws(
      () => percentToTransferRate('-1%'),
      ValidationError,
      'Decimal value must be between 0 and 1.00.',
    )
  })

  it('Throws when TransferRate < 0', function () {
    assert.throws(
      () => decimalToTransferRate('-.01'),
      ValidationError,
      'Decimal value must be between 0 and 1.00.',
    )
  })

  it('Throws when TransferRate >100%', function () {
    assert.throws(
      () => percentToTransferRate('101%'),
      ValidationError,
      'Decimal value must be between 0 and 1.00.',
    )
  })

  it('Throws when TransferRate >1.00', function () {
    assert.throws(
      () => decimalToTransferRate('1.01'),
      ValidationError,
      'Decimal value must be between 0 and 1.00.',
    )
  })

  it('percentToTransferRate greater than maximum precision', function () {
    assert.throws(
      () => percentToTransferRate('.0000000000000011221%'),
      ValidationError,
      'Decimal exceeds maximum precision.',
    )
  })

  it('decimalToTransferRate greater than maximum precision', function () {
    assert.throws(
      () => decimalToTransferRate('.000000000000000011221'),
      ValidationError,
      'Decimal exceeds maximum precision.',
    )
  })

  it('converts 0 percent to valid 0', function () {
    const billionths = percentToTransferRate('0%')

    assert.equal(billionths, 0)
  })

  it('converts 0 to valid 0', function () {
    assert.equal(decimalToTransferRate('0'), 0)
    assert.equal(transferRateToDecimal(0), '0')
  })
})

describe('MPT TransferFee utils', function () {
  it('converts 1 percent to a valid MPT TransferFee', function () {
    assert.equal(percentToMPTTransferFee('1%'), 1000)
  })

  it('converts a fractional percent', function () {
    assert.equal(percentToMPTTransferFee('0.5%'), 500)
    assert.equal(percentToMPTTransferFee('.001%'), 1)
  })

  it('converts 0 percent to 0', function () {
    assert.equal(percentToMPTTransferFee('0%'), 0)
  })

  it('converts the maximum percent to MAX_MPT_TRANSFER_FEE', function () {
    assert.equal(percentToMPTTransferFee('50%'), MAX_MPT_TRANSFER_FEE)
    assert.equal(MAX_MPT_TRANSFER_FEE, MAX_TRANSFER_FEE)
  })

  it('does not use the billionths TransferRate scale', function () {
    assert.notEqual(percentToMPTTransferFee('1%'), percentToTransferRate('1%'))
  })

  it('Throws when the MPT TransferFee is above 50%', function () {
    assert.throws(
      () => percentToMPTTransferFee('51%'),
      ValidationError,
      'Percent value must be between 0% and 50%.',
    )
  })

  it('Throws when the MPT TransferFee is negative', function () {
    assert.throws(
      () => percentToMPTTransferFee('-1%'),
      ValidationError,
      'Percent value must be between 0% and 50%.',
    )
  })

  it('Throws when the percent has more than three decimal places', function () {
    assert.throws(
      () => percentToMPTTransferFee('0.0001%'),
      ValidationError,
      'Decimal exceeds maximum precision.',
    )
  })

  it('Throws when the percent has no % sign', function () {
    assert.throws(() => percentToMPTTransferFee('1'), ValidationError)
  })

  it('converts an MPT TransferFee back to a percent', function () {
    assert.equal(mptTransferFeeToPercent(1000), '1')
    assert.equal(mptTransferFeeToPercent(500), '0.5')
    assert.equal(mptTransferFeeToPercent(1), '0.001')
    assert.equal(mptTransferFeeToPercent(0), '0')
  })

  it('round-trips through percentToMPTTransferFee', function () {
    assert.equal(
      percentToMPTTransferFee(`${mptTransferFeeToPercent(12345)}%`),
      12345,
    )
  })

  it('Throws when decoding a non-integer MPT TransferFee', function () {
    assert.throws(
      () => mptTransferFeeToPercent(1.5),
      ValidationError,
      'MPT TransferFee must be an integer',
    )
  })

  it('Throws when decoding an out-of-range MPT TransferFee', function () {
    assert.throws(
      () => mptTransferFeeToPercent(MAX_MPT_TRANSFER_FEE + 1),
      ValidationError,
      'MPT TransferFee must be between 0 and 50000',
    )
    assert.throws(
      () => mptTransferFeeToPercent(-1),
      ValidationError,
      'MPT TransferFee must be between 0 and 50000',
    )
  })
})
