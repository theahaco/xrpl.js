import { assert } from 'chai'

import { ValidationError, mptToUnits, unitsToMpt } from '../../src'

describe('mptToUnits', function () {
  it('scales a decimal amount by the AssetScale', function () {
    assert.equal(mptToUnits('12.34', 2), '1234')
    assert.equal(mptToUnits(12.34, 2), '1234')
  })

  it('is the identity for an AssetScale of 0', function () {
    assert.equal(mptToUnits('1000'), '1000')
  })

  it('accepts the maximum MPT amount', function () {
    assert.equal(mptToUnits('9223372036854775807'), '9223372036854775807')
  })

  it('throws when the amount has more decimal places than AssetScale', function () {
    assert.throws(
      () => mptToUnits('12.345', 2),
      ValidationError,
      'has more than 2 decimal places',
    )
  })

  it('throws above the maximum MPT amount', function () {
    assert.throws(
      () => mptToUnits('9223372036854775808'),
      ValidationError,
      'exceeds the maximum MPT amount',
    )
  })

  it('throws on a negative amount', function () {
    assert.throws(
      () => mptToUnits('-1', 2),
      ValidationError,
      'must not be negative',
    )
  })

  it('throws on a non-numeric amount', function () {
    assert.throws(() => mptToUnits('abc'), ValidationError, 'invalid value')
  })

  it('throws on an invalid AssetScale', function () {
    assert.throws(
      () => mptToUnits('1', 1.5),
      ValidationError,
      'assetScale must be an integer between 0 and 255',
    )
  })
})

describe('unitsToMpt', function () {
  it('unscales an integer unit count by the AssetScale', function () {
    assert.equal(unitsToMpt('1234', 2), '12.34')
    assert.equal(unitsToMpt(1234, 2), '12.34')
  })

  it('is the identity for an AssetScale of 0', function () {
    assert.equal(unitsToMpt('1000'), '1000')
  })

  it('keeps full precision above Number.MAX_SAFE_INTEGER', function () {
    assert.equal(unitsToMpt('9223372036854775807', 2), '92233720368547758.07')
  })

  it('round-trips with mptToUnits', function () {
    assert.equal(unitsToMpt(mptToUnits('0.07', 2), 2), '0.07')
  })

  it('throws on a non-integer unit count', function () {
    assert.throws(
      () => unitsToMpt('12.34', 2),
      ValidationError,
      'should be a non-negative integer',
    )
  })

  it('throws on a negative unit count', function () {
    assert.throws(
      () => unitsToMpt('-1'),
      ValidationError,
      'should be a non-negative integer',
    )
  })
})
