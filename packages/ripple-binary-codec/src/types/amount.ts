import { BinaryParser } from '../serdes/binary-parser'

import { AccountID } from './account-id'
import { Currency } from './currency'
import { JsonObject, SerializedType } from './serialized-type'
import BigNumber from 'bignumber.js'
import { bytesToHex, concat, hexToBytes } from '@xrplf/isomorphic/utils'
import { readUInt32BE, writeUInt32BE } from '../utils'
import { Hash192 } from './hash-192'

/**
 * Constants for validating amounts
 */
const MIN_IOU_EXPONENT = -96
const MAX_IOU_EXPONENT = 80
const MAX_IOU_PRECISION = 16
const MAX_DROPS = new BigNumber('1e17')
const MIN_XRP = new BigNumber('1e-6')
const mask = BigInt(0x00000000ffffffff)
// MPT amounts are 63-bit unsigned integers (XLS-33)
const MAX_MPT_VALUE = BigInt('9223372036854775807')
// Canonical decimal form as emitted by rippled: no sign, no leading zeros,
// no whitespace, no 0x/0o/0b prefix, no exponent.
const MPT_VALUE_REGEX = /^(?:0|[1-9][0-9]*)$/

/**
 * BigNumber configuration for Amount IOUs
 */
BigNumber.config({
  EXPONENTIAL_AT: [
    MIN_IOU_EXPONENT - MAX_IOU_PRECISION,
    MAX_IOU_EXPONENT + MAX_IOU_PRECISION,
  ],
})

interface AmountObjectIOU extends JsonObject {
  value: string
  currency: string
  issuer: string
}

interface AmountObjectMPT extends JsonObject {
  value: string
  mpt_issuance_id: string
}

/**
 * Interface for JSON objects that represent amounts
 */
type AmountObject = AmountObjectIOU | AmountObjectMPT

/**
 * Type guard for AmountObjectIOU
 */
/**
 * The own keys of an amount object whose value is not `undefined`; such
 * members are dropped by JSON serialisation and must not change the shape.
 */
function definedKeys(arg: object): string[] {
  return Object.keys(arg)
    .filter((key) => arg[key] !== undefined)
    .sort()
}

function isAmountObjectIOU(arg): arg is AmountObjectIOU {
  const keys = definedKeys(arg)

  return (
    keys.length === 3 &&
    keys[0] === 'currency' &&
    keys[1] === 'issuer' &&
    keys[2] === 'value'
  )
}

/**
 * Type guard for AmountObjectMPT
 */
function isAmountObjectMPT(arg): arg is AmountObjectMPT {
  const keys = definedKeys(arg)

  return (
    keys.length === 2 && keys[0] === 'mpt_issuance_id' && keys[1] === 'value'
  )
}

/**
 * Class for serializing/Deserializing Amounts
 */
class Amount extends SerializedType {
  static defaultAmount: Amount = new Amount(hexToBytes('4000000000000000'))

  constructor(bytes: Uint8Array) {
    super(bytes ?? Amount.defaultAmount.bytes)
  }

  /**
   * Construct an amount from an IOU, MPT or string amount
   *
   * @param value An Amount, object representing an IOU, or a string
   *     representing an integer amount
   * @returns An Amount object
   */
  static from<T extends Amount | AmountObject | string>(value: T): Amount {
    if (value instanceof Amount) {
      return value
    }

    let amount: Uint8Array = new Uint8Array(8)
    if (typeof value === 'string') {
      Amount.assertXrpIsValid(value)

      const number = BigInt(value)

      const intBuf = [new Uint8Array(4), new Uint8Array(4)]
      writeUInt32BE(intBuf[0], Number(number >> BigInt(32)), 0)
      writeUInt32BE(intBuf[1], Number(number & BigInt(mask)), 0)

      amount = concat(intBuf)

      amount[0] |= 0x40

      return new Amount(amount)
    }

    if (isAmountObjectIOU(value)) {
      let number: BigNumber
      try {
        number = new BigNumber(value.value)
      } catch (_err) {
        throw new Error(`${value.value} is an illegal amount`)
      }
      Amount.assertIouIsValid(number)

      if (number.isZero()) {
        amount[0] |= 0x80
      } else {
        const integerNumberString = number
          .times(`1e${-((number.e || 0) - 15)}`)
          .abs()
          .toString()

        const num = BigInt(integerNumberString)
        const intBuf = [new Uint8Array(4), new Uint8Array(4)]
        writeUInt32BE(intBuf[0], Number(num >> BigInt(32)), 0)
        writeUInt32BE(intBuf[1], Number(num & BigInt(mask)), 0)

        amount = concat(intBuf)

        amount[0] |= 0x80

        if (number.gt(new BigNumber(0))) {
          amount[0] |= 0x40
        }

        const exponent = (number.e || 0) - 15
        const exponentByte = 97 + exponent
        amount[0] |= exponentByte >>> 2
        amount[1] |= (exponentByte & 0x03) << 6
      }

      const currency = Currency.from(value.currency).toBytes()
      const issuer = AccountID.from(value.issuer).toBytes()
      return new Amount(concat([amount, currency, issuer]))
    }

    if (isAmountObjectMPT(value)) {
      Amount.assertMptIsValid(value.value)

      let leadingByte = new Uint8Array(1)
      leadingByte[0] |= 0x60

      const num = BigInt(value.value)

      const intBuf = [new Uint8Array(4), new Uint8Array(4)]
      writeUInt32BE(intBuf[0], Number(num >> BigInt(32)), 0)
      writeUInt32BE(intBuf[1], Number(num & BigInt(mask)), 0)

      amount = concat(intBuf)

      const mptIssuanceID = Hash192.from(value.mpt_issuance_id).toBytes()
      return new Amount(concat([leadingByte, amount, mptIssuanceID]))
    }

    throw new Error('Invalid type to construct an Amount')
  }

  /**
   * Read an amount from a BinaryParser
   *
   * @param parser BinaryParser to read the Amount from
   * @returns An Amount object
   */
  static fromParser(parser: BinaryParser): Amount {
    const isIOU = parser.peek() & 0x80
    if (isIOU) return new Amount(parser.read(48))

    // the amount can be either MPT or XRP at this point
    const isMPT = parser.peek() & 0x20
    const numBytes = isMPT ? 33 : 8
    return new Amount(parser.read(numBytes))
  }

  /**
   * Get the JSON representation of this Amount
   *
   * @returns the JSON interpretation of this.bytes
   */
  toJSON(): AmountObject | string {
    if (this.isNative()) {
      const bytes = this.bytes.slice()
      const isPositive = bytes[0] & 0x40
      const sign = isPositive ? '' : '-'
      bytes[0] &= 0x3f

      const msb = BigInt(readUInt32BE(bytes.slice(0, 4), 0))
      const lsb = BigInt(readUInt32BE(bytes.slice(4), 0))
      const num = (msb << BigInt(32)) | lsb

      return `${sign}${num.toString()}`
    }

    if (this.isIOU()) {
      const parser = new BinaryParser(this.toString())
      const mantissa = parser.read(8)
      const currency = Currency.fromParser(parser) as Currency
      const issuer = AccountID.fromParser(parser) as AccountID

      const b1 = mantissa[0]
      const b2 = mantissa[1]

      const isPositive = b1 & 0x40
      const sign = isPositive ? '' : '-'
      const exponent = ((b1 & 0x3f) << 2) + ((b2 & 0xff) >> 6) - 97

      mantissa[0] = 0
      mantissa[1] &= 0x3f
      const value = new BigNumber(`${sign}0x${bytesToHex(mantissa)}`).times(
        `1e${exponent}`,
      )
      Amount.assertIouIsValid(value)

      return {
        value: value.toString(),
        currency: currency.toJSON(),
        issuer: issuer.toJSON(),
      }
    }

    if (this.isMPT()) {
      const parser = new BinaryParser(this.toString())
      const leadingByte = parser.read(1)
      const amount = parser.read(8)
      const mptID = Hash192.fromParser(parser) as Hash192

      const isPositive = leadingByte[0] & 0x40
      const sign = isPositive ? '' : '-'

      const msb = BigInt(readUInt32BE(amount.slice(0, 4), 0))
      const lsb = BigInt(readUInt32BE(amount.slice(4), 0))
      const num = (msb << BigInt(32)) | lsb

      return {
        value: `${sign}${num.toString()}`,
        mpt_issuance_id: mptID.toString(),
      }
    }

    throw new Error('Invalid amount to construct JSON')
  }

  /**
   * Validate XRP amount
   *
   * @param amount String representing XRP amount
   * @returns void, but will throw if invalid amount
   */
  private static assertXrpIsValid(amount: string): void {
    if (amount.indexOf('.') !== -1) {
      throw new Error(`${amount.toString()} is an illegal amount`)
    }

    let decimal: BigNumber
    try {
      decimal = new BigNumber(amount)
    } catch (_err) {
      throw new Error(`${amount.toString()} is an illegal amount`)
    }
    if (!decimal.isZero()) {
      if (decimal.lt(MIN_XRP) || decimal.gt(MAX_DROPS)) {
        throw new Error(`${amount.toString()} is an illegal amount`)
      }
    }
  }

  /**
   * Validate IOU.value amount
   *
   * @param decimal BigNumber object representing IOU.value
   * @returns void, but will throw if invalid amount
   */
  private static assertIouIsValid(decimal: BigNumber): void {
    if (!decimal.isZero()) {
      const p = decimal.precision()
      const e = (decimal.e || 0) - 15
      if (
        p > MAX_IOU_PRECISION ||
        e > MAX_IOU_EXPONENT ||
        e < MIN_IOU_EXPONENT
      ) {
        throw new Error('Decimal precision out of range')
      }
      this.verifyNoDecimal(decimal)
    }
  }

  /**
   * Validate MPT.value amount
   *
   * Accepts exactly the canonical decimal form (`/^(0|[1-9][0-9]*)$/`) in the
   * range 0 to 2^63 - 1. Anything else (sign, whitespace, `0x` prefix,
   * exponent, decimal point, out-of-range magnitude) is rejected before
   * serialization so that no value can be silently truncated on the wire.
   *
   * @param amount String representing MPT.value
   * @returns void, but will throw if invalid amount
   */
  private static assertMptIsValid(amount: string): void {
    if (typeof amount !== 'string' || !MPT_VALUE_REGEX.test(amount)) {
      throw new Error(`${String(amount)} is an illegal amount`)
    }

    if (BigInt(amount) > MAX_MPT_VALUE) {
      throw new Error(`${amount} is an illegal amount`)
    }
  }

  /**
   * Ensure that the value after being multiplied by the exponent does not
   * contain a decimal.
   *
   * @param decimal a Decimal object
   * @returns a string of the object without a decimal
   */
  private static verifyNoDecimal(decimal: BigNumber): void {
    const integerNumberString = decimal
      .times(`1e${-((decimal.e || 0) - 15)}`)
      .abs()
      .toString()

    if (integerNumberString.indexOf('.') !== -1) {
      throw new Error('Decimal place found in integerNumberString')
    }
  }

  /**
   * Test if this amount is in units of Native Currency(XRP)
   *
   * @returns true if Native (XRP)
   */
  private isNative(): boolean {
    return (this.bytes[0] & 0x80) === 0 && (this.bytes[0] & 0x20) === 0
  }

  /**
   * Test if this amount is in units of MPT
   *
   * @returns true if MPT
   */
  private isMPT(): boolean {
    return (this.bytes[0] & 0x80) === 0 && (this.bytes[0] & 0x20) !== 0
  }

  /**
   * Test if this amount is in units of IOU
   *
   * @returns true if IOU
   */
  private isIOU(): boolean {
    return (this.bytes[0] & 0x80) !== 0
  }
}

export { Amount, AmountObject }
