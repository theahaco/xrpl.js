import { ValidationError } from '../errors'
import type { Memo } from '../models/common'

const HEX_RADIX = 16

export interface TextMemo {
  type?: string
  data?: string
  format?: string
}

function encodeText(value: string | undefined): string | undefined {
  return value === undefined
    ? undefined
    : Array.from(new TextEncoder().encode(value), (byte) =>
        byte.toString(HEX_RADIX).padStart(2, '0'),
      )
        .join('')
        .toUpperCase()
}

function decodeText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!/^(?:[0-9a-f]{2})*$/iu.test(value)) {
    throw new ValidationError('Memo contains invalid hexadecimal text.')
  }
  const bytes = Uint8Array.from(value.match(/../gu) ?? [], (byte) =>
    Number.parseInt(byte, HEX_RADIX),
  )
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

/**
 * Encode a UTF-8 memo wrapper in Node or a browser without a Buffer global.
 *
 * @param memo - Human-readable memo fields; omit fields that are not needed.
 * @returns A wrapper suitable for a transaction's Memos array.
 */
export function encodeMemo(memo: TextMemo): Memo {
  const fields = {
    MemoType: encodeText(memo.type),
    MemoData: encodeText(memo.data),
    MemoFormat: encodeText(memo.format),
  }
  return {
    Memo: Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    ),
  }
}

/**
 * Decode a text memo. Arbitrary binary memos are valid on ledger but not UTF-8;
 * callers should catch a decoding error and retain/skip that memo as appropriate.
 *
 * @param memo - Ledger memo wrapper.
 * @returns Decoded UTF-8 fields.
 * @throws Error for malformed hex or non-UTF-8 content.
 */
export function decodeMemo(memo: Memo): TextMemo {
  return {
    type: decodeText(memo.Memo.MemoType),
    data: decodeText(memo.Memo.MemoData),
    format: decodeText(memo.Memo.MemoFormat),
  }
}
