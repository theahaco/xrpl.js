import { coreTypes } from '../src/types'
import fixtures from './fixtures/data-driven-tests.json'

import { makeParser } from '../src/binary'
const { Amount, SignedAmount } = coreTypes

const MPT_ISSUANCE_ID = '00002403C84A0A28E0190E208E982C352BBD5006600555CF'

/**
 * Maps each fixture `error` label to the message the codec is expected to
 * throw for it, so a vector that throws for the wrong reason (or throws a
 * raw `SyntaxError`/`TypeError`) fails the test instead of passing on a bare
 * `toThrow()`.
 */
const ERROR_LABEL_TO_MESSAGE: Record<string, RegExp> = {
  'Value is negative': /is an illegal amount$/,
  'Value is too large': /is an illegal amount$/,
  'Value has decimal point': /is an illegal amount$/,
  'Value is not a decimal integer': /is an illegal amount$/,
  'Value has hex prefix': /is an illegal amount$/,
  'Value has explicit sign': /is an illegal amount$/,
  'Value has whitespace': /is an illegal amount$/,
  'Value has exponent': /is an illegal amount$/,
  'Value has leading zeros': /is an illegal amount$/,
  'Value is empty': /is an illegal amount$/,
  'Value has bad character': /is an illegal amount$/,
  'mpt_issuance_id has invalid hash length': /^Invalid Hash length/,
  'Issuer not valid for MPT': /^Invalid type to construct an Amount$/,
  'Currency not valid for MPT': /^Invalid type to construct an Amount$/,
  'value precision of 17 is greater than maximum iou precision of 16':
    /^Decimal precision out of range$/,
  'exponent is too large': /^Decimal precision out of range$/,
  '1000000000000 absolute XRP is bigger than max native value 100000000000.0':
    /is an illegal amount$/,
  '10000000000000000000 absolute XRP is bigger than max native value 100000000000.0':
    /is an illegal amount$/,
}

function amountErrorTests() {
  fixtures.values_tests
    .filter((obj) => obj.type === 'Amount')
    .forEach((f) => {
      // We only want these with errors
      if (!f.error) {
        return
      }
      const testName =
        `${JSON.stringify(f.test_json)}\n\tis invalid ` + `because: ${f.error}`
      it(testName, () => {
        const expectedMessage = ERROR_LABEL_TO_MESSAGE[f.error]
        // A new fixture label must be mapped to the message it is expected to
        // produce; otherwise the test could pass on an unrelated throw.
        expect(expectedMessage).toBeDefined()

        let thrown: unknown
        try {
          Amount.from(f.test_json)
        } catch (err) {
          thrown = err
        }
        expect(thrown).toBeInstanceOf(Error)
        // The codec's own Error, never a leaked SyntaxError/TypeError from
        // BigInt()/BigNumber parsing.
        expect((thrown as Error).constructor).toBe(Error)
        expect((thrown as Error).message).toMatch(expectedMessage)
      })
    })
}

describe('Amount', function () {
  it('can be parsed from', function () {
    expect(Amount.from('1000000') instanceof Amount).toBe(true)
    expect(Amount.from('1000000').toJSON()).toEqual('1000000')

    // it not valid to have negative XRP. But we test it anyways
    // to ensure logic correctness for toJSON of the Amount class
    {
      const parser = makeParser('0000000000000001')
      const value = parser.readType(Amount)
      const json = value.toJSON()
      expect(json).toEqual('-1')
    }

    const fixture = {
      value: '1',
      issuer: '0000000000000000000000000000000000000000',
      currency: 'USD',
    }
    const amt = Amount.from(fixture)
    const rewritten = {
      value: '1',
      issuer: 'rrrrrrrrrrrrrrrrrrrrrhoLvTp',
      currency: 'USD',
    }
    expect(amt.toJSON()).toEqual(rewritten)
  })

  it('can be parsed from MPT', function () {
    let fixture = {
      value: '100',
      mpt_issuance_id: '00002403C84A0A28E0190E208E982C352BBD5006600555CF',
    }
    let amt = Amount.from(fixture)
    expect(amt.toJSON()).toEqual(fixture)

    fixture = {
      value: '9223372036854775807',
      mpt_issuance_id: '00002403C84A0A28E0190E208E982C352BBD5006600555CF',
    }
    amt = Amount.from(fixture)
    expect(amt.toJSON()).toEqual(fixture)

    // it not valid to have negative MPT. But we test it anyways
    // to ensure logic correctness for toJSON of the Amount class
    {
      const parser = makeParser(
        '20000000000000006400002403C84A0A28E0190E208E982C352BBD5006600555CF',
      )
      const value = parser.readType(Amount)
      const json = value.toJSON()
      expect(json).toEqual({
        mpt_issuance_id: '00002403C84A0A28E0190E208E982C352BBD5006600555CF',
        value: '-100',
      })
    }
  })
  it('rejects non-numeric MPT amount values with a validation error', function () {
    const mpt = {
      value: 'abc',
      mpt_issuance_id: MPT_ISSUANCE_ID,
    }
    expect(() => Amount.from(mpt)).toThrow(
      new Error(mpt.value + ' is an illegal amount'),
    )
  })

  it('round-trips MPT values across the whole 0..2^63-1 range', function () {
    for (const value of ['0', '1', '4294967296', '9223372036854775807']) {
      const amt = Amount.from({ value, mpt_issuance_id: MPT_ISSUANCE_ID })
      expect(amt.toJSON()).toEqual({ value, mpt_issuance_id: MPT_ISSUANCE_ID })
    }
  })

  it('rejects MPT values at or above 2^63 instead of truncating them', function () {
    // Bit 63 set (already rejected) and bit 63 clear with higher bits set
    // (previously truncated to the low 64 bits: 2^64 + 5 encoded as 5).
    const values = [
      '9223372036854775808', // 2^63
      '18446744073709551615', // 2^64 - 1
      '18446744073709551616', // 2^64
      '18446744073709551621', // 2^64 + 5
      '36893488147419103232', // 2^65
      '340282366920938463463374607431768211456', // 2^128
    ]
    for (const value of values) {
      expect(() =>
        Amount.from({ value, mpt_issuance_id: MPT_ISSUANCE_ID }),
      ).toThrow(new Error(`${value} is an illegal amount`))
    }
  })

  it('rejects non-canonical MPT value strings with the codec error', function () {
    // BigInt()/BigNumber would otherwise reinterpret these ("0x10" -> 16,
    // "+7" -> 7, " 9" -> 9) or leak a SyntaxError ("1e2").
    const values = [
      '0x10',
      '0b1',
      '0o7',
      '+7',
      ' 9',
      '9 ',
      '1e2',
      '007',
      '-0',
      '1_000',
      '',
    ]
    for (const value of values) {
      let thrown: unknown
      try {
        Amount.from({ value, mpt_issuance_id: MPT_ISSUANCE_ID })
      } catch (err) {
        thrown = err
      }
      expect((thrown as Error).constructor).toBe(Error)
      expect((thrown as Error).message).toBe(`${value} is an illegal amount`)
    }
  })

  it('rejects a non-string MPT value with the codec error', function () {
    expect(() =>
      Amount.from({
        value: 5 as unknown as string,
        mpt_issuance_id: MPT_ISSUANCE_ID,
      }),
    ).toThrow(new Error('5 is an illegal amount'))
  })

  it('toJSON() does not mutate internal buffer for native XRP amounts', function () {
    const amt = Amount.from('1000000')
    const serializedHexBeforeJsonCalls = amt.toHex()
    const firstJsonResult = amt.toJSON()
    const secondJsonResult = amt.toJSON()
    expect(secondJsonResult).toEqual(firstJsonResult)
    expect(amt.toHex()).toEqual(serializedHexBeforeJsonCalls)
  })

  it('toJSON() does not mutate internal buffer for IOU amounts', function () {
    const amt = Amount.from({
      value: '1',
      issuer: '0000000000000000000000000000000000000000',
      currency: 'USD',
    })
    const serializedHexBeforeJsonCalls = amt.toHex()
    const firstJsonResult = amt.toJSON()
    const secondJsonResult = amt.toJSON()
    expect(secondJsonResult).toEqual(firstJsonResult)
    expect(amt.toHex()).toEqual(serializedHexBeforeJsonCalls)
  })

  it('toJSON() does not mutate internal buffer for negative IOU amounts', function () {
    const amt = Amount.from({
      value: '-1',
      issuer: '0000000000000000000000000000000000000000',
      currency: 'USD',
    })
    const serializedHexBeforeJsonCalls = amt.toHex()
    const firstJsonResult = amt.toJSON()
    const secondJsonResult = amt.toJSON()
    expect(secondJsonResult).toEqual(firstJsonResult)
    expect(amt.toHex()).toEqual(serializedHexBeforeJsonCalls)
  })

  it('toJSON() does not mutate internal buffer for MPT amounts', function () {
    const amt = Amount.from({
      value: '100',
      mpt_issuance_id: '00002403C84A0A28E0190E208E982C352BBD5006600555CF',
    })
    const serializedHexBeforeJsonCalls = amt.toHex()
    const firstJsonResult = amt.toJSON()
    const secondJsonResult = amt.toJSON()
    expect(secondJsonResult).toEqual(firstJsonResult)
    expect(amt.toHex()).toEqual(serializedHexBeforeJsonCalls)
  })

  it('toJSON() does not mutate internal buffer for negative MPT amounts', function () {
    const parser = makeParser(
      '20000000000000006400002403C84A0A28E0190E208E982C352BBD5006600555CF',
    )
    const amt = parser.readType(Amount)
    const serializedHexBeforeJsonCalls = amt.toHex()
    const firstJsonResult = amt.toJSON()
    const secondJsonResult = amt.toJSON()
    expect(secondJsonResult).toEqual(firstJsonResult)
    expect(amt.toHex()).toEqual(serializedHexBeforeJsonCalls)
  })

  amountErrorTests()
})

describe('SignedAmount', function () {
  it('round-trips a negative native XRP amount (e.g. FeeAmountDelta)', function () {
    expect(SignedAmount.from('-1000000').toJSON()).toEqual('-1000000')
  })

  it('round-trips a positive native XRP amount', function () {
    expect(SignedAmount.from('1000000').toJSON()).toEqual('1000000')
  })

  it('rejects out-of-range negative magnitudes the same as Amount', function () {
    expect(() => SignedAmount.from('-100000000000000001')).toThrow()
  })

  it('does not affect the base Amount type, which still rejects negative XRP', function () {
    expect(() => Amount.from('-1000000')).toThrow()
  })

  it('rejects a malformed string that BigNumber parses as NaN instead of throwing', function () {
    expect(() => SignedAmount.from('abc')).toThrow()
  })

  it('rejects scientific notation that BigNumber accepts but BigInt rejects', function () {
    expect(() => SignedAmount.from('1e5')).toThrow()
  })
})
