# `Client.requestAll` goes straight to `connection.request`, skipping the partial-payment warnings and X-address normalisation that `Client.request` adds

Severity: minor
Category: rpc

## Affected surface

- `Client.requestAll` — `packages/xrpl/src/client/index.ts:478-527` (`:506`
  `const singleResponse = await this.connection.request(repeatProps)`)
- Contrast `Client.request` — `client/index.ts:360-371` (`ensureClassicAddress(req.account)`;
  `handlePartialPayment(req.command, response)`)
- `handlePartialPayment` — `packages/xrpl/src/client/partialPayment.ts:164-183` (MPT-aware via
  `amountsEqual`, `:44-52`)
- Callers: `getBalances` (`:1030-1039`), `getOrderbook` (`:1076-`), and every paginated
  `account_tx`/`account_objects` scan a user writes

## Repro

Code read (the only request path in `requestAll` is the raw connection call; `grep -n
handlePartialPayment\|ensureClassicAddress` inside lines 478-527 matches nothing). Consequences:

- `requestAll({ command: 'account_tx', account: issuer })` — the natural way to scan an issuer's
  history — never carries the `warnings: [{ id: 2001, … }]` partial-payment annotation that the
  same page fetched via `request` does.
- `requestAll({ command: 'account_objects', account: xAddress, type: 'mptoken' })` sends the
  X-address raw; rippled rejects it (`actMalformed`), while `request` would have converted it.

## Expected vs actual

Expected: `requestAll` is `request` in a loop; every per-response behaviour applies to each page.

Actual: two behaviours differ silently. The partial-payment warning is exactly the signal a
compliance issuer scanning `account_tx` for MPT payments is looking for (a `tfPartialPayment` MPT
payment delivers less than `Amount`; `probes.ts` shows MPT partial payments are allowed on rippled).

## Root cause

`requestAll` was written against the connection to control the `marker` loop.

## Proposed fix

Non-breaking:

```diff
-      const singleResponse = await this.connection.request(repeatProps)
+      const singleResponse = await this.request(repeatProps)
```

(`request` already forwards `api_version`; `marker`/`limit` pass through unchanged.)

## Workaround today

Loop over `client.request` with `marker` by hand.

## References

- xrpl.org "Partial Payments" (the `delivered_amount` warning); `packages/xrpl/src/client/partialPayment.ts`
- Related: [007](007-account-objects-type-filter-does-not-narrow.md), [021](021-ci-xrpld-cfg-missing-newer-amendments.md)
