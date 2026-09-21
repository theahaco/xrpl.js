# `autofill` re-reads `account_info` for every transaction and reserves nothing, so concurrent `submitAndWait` calls from one account collide on `Sequence` (`tefPAST_SEQ`) after a full polling timeout; the repo's own harness carries the retry loop

Severity: minor
Category: runtime

## Affected surface

- `getNextValidSequenceNumber` — `packages/xrpl/src/sugar/autofill.ts:235-246` (`account_info` with
  `ledger_index: 'current'`, returns `account_data.Sequence`; no reservation, no in-flight tracking)
- `Client.submitAndWait` — `packages/xrpl/src/client/index.ts:862-898` (no documentation of the
  constraint; `grep -n -i 'parallel\|concurren\|tefPAST_SEQ' src/client/index.ts src/sugar/*.ts` →
  nothing)
- The repo's own workaround: `packages/xrpl/test/integration/utils.ts:263-264` ("As of Sep 2022,
  xrpl.js does not track requests sent in parallel. Our sequence numbers can get off from the
  server's sequence numbers. This is a fix to retry the transaction if it fails due to tefPAST_SEQ.")
  and the retry loop at `:128-178`

## Repro

Live (rippled 3.4.0-rc1, `audit/README.md` round-3 log), issuer locks two holders at once:

```ts
await Promise.allSettled([a, b].map((h) => client.submitAndWait(holderLockTx(id, issuer, h), { wallet })))
```

```
concurrent submitAndWait -> resolved tesSUCCESS (Sequence 737)
concurrent submitAndWait -> rejected after 9153ms: tefPAST_SEQ
```

Both autofills read `Sequence 737`; the loser is rejected by rippled at submit with `tefPAST_SEQ`,
which `submitAndWait` does not treat as terminal (only `tem*` is), so it polls until
`LastLedgerSequence` passes and then throws with the code buried in prose
([025](025-submitandwait-three-failure-surfaces-no-result-helper.md)).

## Expected vs actual

Expected: either the client serialises autofill per account (a small in-memory "next sequence"
reservation, invalidated on failure), or `submitAndWait`/`autofill` document "one in-flight
transaction per account unless you use Tickets", and `tef*` at submission is reported immediately
rather than after the expiry wait.

Actual: the natural compliance pattern — "lock every banned holder now" — fails for all but one
transaction, ~9 s later, with an error that looks like a network expiry. Sequential submission
(what `audit/mpt-issuer` does everywhere) is the undocumented requirement.

## Root cause

Stateless autofill; `tef*` not treated as terminal at submit.

## Proposed fix

Non-breaking, two parts:

1. In `submitAndWait`, treat `tef*` (and `tel*`?) preliminary results as terminal failures with a
   typed error (part of [025](025-submitandwait-three-failure-surfaces-no-result-helper.md)'s
   `TransactionFailedError`) — they will never be included.
2. Optional per-client sequence reservation: `Client` keeps `Map<account, { next: number; ledger: number }>`,
   `autofill` uses `max(server Sequence, reserved)` and bumps; reset on `tefPAST_SEQ`/reconnect.
   Or, minimally, a `@remarks` on `submitAndWait`: "Do not submit concurrently from one account
   without `TicketSequence`."

## Workaround today

Submit sequentially per account, or use Tickets (`TicketCreate` + `TicketSequence`, with the
derivation caveat of [047](047-mptokenissuance-sequence-doc-wrong-for-ticketed-creates.md)).

## References

- xrpl.org "Reliable Transaction Submission", "Tickets"
- Related: [025](025-submitandwait-three-failure-surfaces-no-result-helper.md), [062](062-submitandwait-expiry-check-precedes-final-tx-lookup.md)
