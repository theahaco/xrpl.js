# Carbon Coin follow-up stack

Tracking epic: https://github.com/theahaco/xrpl.js/issues/58

1. Outcomes and optional ledger reads: integrates relevant helper code from #54/#38 and the final-lookup ordering from #45, retaining #57's validated-success contract and retryable preliminary-result polling. Also brings in exact MPT unit conversions from #54. This is an integration onto #57, not a replacement for those focused proposals.
2. Account-bound builders and wallet scopes on one connection.
3. Immutable multisig preparation and co-signing.
4. Advisory MPT readiness, complete payment history and browser-safe memo helpers.
5. Carbon Coin consumes the final SDK pin and demonstrates deleted app scaffolding.

No npm release or upstream repository writes are part of this stack. Proposed APIs are exercised in the downstream application before being described as complete.
