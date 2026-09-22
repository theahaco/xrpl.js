# `tfMPTCanTrade` / `tfMPTSetCanClawback` docs promise DEX, AMM and `AMMClawback` for MPTs; rippled answers `temDISABLED` and no SDK offer/AMM/book type accepts an MPT

Severity: paper-cut
Category: docs

## Affected surface

- `MPTokenIssuanceCreateFlags.tfMPTCanTrade` doc — `packages/xrpl/src/models/transactions/MPTokenIssuanceCreate.ts:44-48`
  ("trade their balances using the XRP Ledger DEX or AMM"); `MPTokenIssuanceSetFlags.tfMPTSetCanTrade` — `MPTokenIssuanceSet.ts:58-61`
- `tfMPTSetCanClawback` docs — `MPTokenIssuanceSet.ts:66-70`, `:113-117` ("via `Clawback` or `AMMClawback`")
- Types that cannot carry an MPT: `OfferCreate.TakerGets/TakerPays: Amount` (`offerCreate.ts:115-117`),
  `Offer.TakerGets/TakerPays: Amount` (`models/ledger/Offer.ts:30,35`), `AMMCreate.Amount: Amount`
  (`AMMCreate.ts:27,32`), `AMMClawback.Amount?: IssuedCurrencyAmount` (`AMMClawback.ts:70`),
  `BookOfferCurrency` (`models/methods/bookOffers.ts:6-9`, no `mpt_issuance_id`) — while
  `SubscribeBook.taker_gets: Currency` (`subscribe.ts:24-29`) does accept `MPTCurrency`
- Codec already has `TakerPaysMPT`/`TakerGetsMPT` fields (`packages/ripple-binary-codec/src/enums/definitions.json`)
  that no model exposes

## Repro

rippled 3.4.0-rc1 with every supported non-obsolete amendment preset except the 11 in
[021](021-ci-xrpld-cfg-missing-newer-amendments.md) (none of which concerns the DEX):

```
OfferCreate with MPT TakerGets (simulate): temDISABLED
```

(`audit/README.md` round-2 log.) Type side (compiled): `TakerGets: { mpt_issuance_id, value }` on
`OfferCreate` → TS2322; `getOrderbook`/`book_offers` with `{ mpt_issuance_id }` → TS2353, while the
`subscribe` book literal with the same object compiles.

## Expected vs actual

Expected: the flag docs say "reserved for a future amendment; no effect today", and the DEX/AMM
request types are consistent about MPT (either all accept it or none do).

Actual: the docs advertise DEX/AMM trading and AMM clawback as available, the ledger rejects it,
and the SDK's own types could not build the transaction even if it were accepted. An issuer deciding
whether to pin `tifMPTCanTrade` (this audit does) gets no help from the docs.

## Root cause

Docs transcribed from XLS-33's forward-looking flag list; the request types were written per-method.

## Proposed fix

Docs only for the flags ("Reserved: marks the issuance as tradable on the DEX/AMM once a future
amendment enables MPT trading; has no effect on rippled 3.x. The SDK's `OfferCreate`/`AMM*` models
do not accept MPT amounts."). For the types, align `BookOfferCurrency` with `Currency` (or vice
versa) so the two book descriptions agree; revisit when an MPT-DEX amendment ships.

## Workaround today

None needed; pin `tifMPTCanTrade` if the promise matters.

## References

- XLS-33 §Flags (`lsfMPTCanTrade` "reserved")
- Related: [017](017-amount-type-excludes-mptamount.md), [046](046-mptokenissuancecreate-doc-says-flags-immutable.md)
