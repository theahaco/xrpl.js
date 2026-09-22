# `ledger_entry`'s `credential` lookup is typed with `credentialType`; rippled requires `credential_type` and rejects the only form that compiles

Severity: major
Category: rpc

## Affected surface

- `LedgerEntryRequest.credential` — `packages/xrpl/src/models/methods/ledgerEntry.ts:86-101`
  (doc at `:87` says "requires subject, issuer, and credential_type sub-fields"; type at `:99` says
  `credentialType: string`)

## Repro

Live (rippled 3.4.0-rc1, `audit/README.md` round-2 log), same credential, two spellings:

```
ledger_entry credential {credential_type}   ok -> Credential Flags=0
ledger_entry credential {credentialType}    error -> malformedRequest / Missing field 'credential_type'.
```

Type side:

```ts
client.request({ command: 'ledger_entry', credential: { subject, issuer, credential_type: '4B5943' } })
// TS2353: Object literal may only specify known properties, and 'credential_type' does not exist …
//         (and: Property 'credentialType' is missing)
```

So the form that type-checks is the form rippled rejects, and the form rippled accepts needs a cast
(or the `BaseRequest` index-signature loophole of [055](055-ledger-entry-request-lacks-lookup-members-index-signature-hides-typos.md)).

## Expected vs actual

Expected: `credential_type`, as documented in the SDK's own comment one line above and on
xrpl.org.

Actual: camelCase key. This is the read for "does this holder hold an accepted credential for my
domain?" — the admission check of the permissioned-domain route
([028](028-pre-emptive-ban-not-expressible-on-ledger.md)).

## Root cause

Typo when the lookup was added; no fixture-driven test for the request shape.

## Proposed fix

Breaking for anyone who wrote `credentialType` (their requests never worked); fix the key:

```diff
   credential?:
     | {
         subject: string
         issuer: string
-        credentialType: string
+        credential_type: string
       }
     | string
```

## Workaround today

Pass `credential_type` and cast the request, or use `client.connection.request`.

## References

- xrpl.org `ledger_entry` → "Get Credential object" (`credential.credential_type`)
- Related: [055](055-ledger-entry-request-lacks-lookup-members-index-signature-hides-typos.md), [028](028-pre-emptive-ban-not-expressible-on-ledger.md)
