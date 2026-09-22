# @xrplf/isomorphic Release History

## Unreleased

### Fixed
* `hexToBytes` and `hexToString` now throw on an odd-length hex string instead of silently dropping the trailing nibble (node) or flooring the byte count (browser).

## 1.0.2 (2026-06-04)
* bump @noble/hashes from 1.8.0 to 2.0.1

## 1.0.1 (2024-06-03)

### Fixed

* Throw error if `hexToBytes` or `hexToString` is provided a string that is not in hex

## 1.0.0 (2024-02-01)

Initial release providing isomorphic and tree-shakable implementations of:

* ripemd160
* sha256
* sha512
* bytesToHash
* hashToBytes
* hexToString
* stringToHex
* randomBytes
* stringToHex
* ws
