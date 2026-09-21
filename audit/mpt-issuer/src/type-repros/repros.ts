/**
 * Compile-time repros for the type-level findings.
 *
 * Every `@ts-expect-error` below marks a line that the SDK's types reject but
 * that a correct API should accept (or vice-versa, marked "compiles but
 * shouldn't"). `npm run type-repros` runs `tsc` over this file: it passes
 * (exit 0) while the findings are real, and starts failing with
 * "Unused '@ts-expect-error' directive" as soon as a finding is fixed
 * upstream. Nothing here is executed.
 */
/* eslint-disable @typescript-eslint/no-unused-vars, no-unused-vars */
import {
  Client,
  LedgerEntry,
  MPTokenIssuanceCreate,
  MPTokenIssuanceSet,
  Payment,
  Wallet,
  // AUDIT-031: not exported at the root; only available as `LedgerEntry.MPToken`.
  // @ts-expect-error
  MPToken,
} from 'xrpl'

declare const client: Client
declare const wallet: Wallet
declare const issuanceId: string
declare const createTx: MPTokenIssuanceCreate
declare const setTx: MPTokenIssuanceSet

type Expect<T extends true> = T
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

// ---------------------------------------------------------------------------
// AUDIT-001: submitAndWait meta is `TransactionMetadata<T> | string | undefined`
// even though the sugar never requests binary metadata and only resolves once
// validated. Both `string` and `undefined` block direct access.
// ---------------------------------------------------------------------------
export async function audit001(): Promise<void> {
  const res = await client.submitAndWait(createTx, { wallet })
  // @ts-expect-error -- Property 'TransactionResult' does not exist on type 'string'
  const code: string = res.result.meta.TransactionResult
  // Even `!` only strips undefined, not string:
  // @ts-expect-error -- Property 'TransactionResult' does not exist on type 'string'
  const code2: string = res.result.meta!.TransactionResult
}

// ---------------------------------------------------------------------------
// AUDIT-002: Wallet.sign() is not generic, so signing erases the transaction
// type; submitting the blob falls back to the full SubmittableTransaction
// union and `meta` becomes the union of every metadata shape.
// ---------------------------------------------------------------------------
export async function audit002(): Promise<void> {
  const { tx_blob } = wallet.sign(createTx)
  type Blob = typeof tx_blob
  type _blobIsPlainString = Expect<Equal<Blob, string>>

  const res = await client.submitAndWait(tx_blob)
  const meta = res.result.meta
  if (typeof meta === 'object') {
    // @ts-expect-error -- mpt_issuance_id does not exist on every member of the metadata union
    const id: string | undefined = meta.mpt_issuance_id
  }
  // The workaround is an unchecked assertion of intent:
  const typed = await client.submitAndWait<MPTokenIssuanceCreate>(tx_blob)
  if (typeof typed.result.meta === 'object') {
    const id: string | undefined = typed.result.meta.mpt_issuance_id // ok, but nothing verified the blob is that type
  }
}

// ---------------------------------------------------------------------------
// AUDIT-003: object literals assigned to an un-annotated `const` widen their
// discriminant to `string` and stop being assignable to any transaction type;
// the SDK offers no factory, so callers add `satisfies`/annotations by hand.
// (Inline literals passed straight to the API are fine — contextual typing.)
// ---------------------------------------------------------------------------
export async function audit003(): Promise<void> {
  const tx = {
    TransactionType: 'MPTokenIssuanceSet',
    Account: wallet.classicAddress,
    MPTokenIssuanceID: issuanceId,
    Flags: 1,
  }
  // @ts-expect-error -- Type 'string' is not assignable to type '"AccountSet" | ...'
  await client.submitAndWait(tx, { wallet })
  // Works: annotation, `satisfies`, or an inline literal.
  await client.submitAndWait({ ...tx, TransactionType: 'MPTokenIssuanceSet' }, { wallet })
}

// ---------------------------------------------------------------------------
// AUDIT-004: BaseTransaction extends Record<string, unknown>, so `keyof` of
// every transaction interface is `string | number` and Omit/Partial silently
// no-op. These COMPILE and should not.
// ---------------------------------------------------------------------------
type _keyofCollapses = Expect<Equal<keyof MPTokenIssuanceSet, string | number>>
const anyKeyIsAKey: keyof MPTokenIssuanceSet = 'definitely-not-a-field' // compiles
const omitDoesNothing: Omit<MPTokenIssuanceSet, 'MPTokenIssuanceID'> = {} // compiles: no required fields survive
const stillHasOmittedField: Omit<MPTokenIssuanceSet, 'Holder'> = { Holder: 'r...' } // compiles
// Pick still works only because 'Holder' extends string:
const pickWorks: Pick<MPTokenIssuanceSet, 'Holder'> = { Holder: 'r...' }
// And a typo in a field name is not caught anywhere on the literal:
const typoAccepted: MPTokenIssuanceSet = {
  TransactionType: 'MPTokenIssuanceSet',
  Account: 'r...',
  MPTokenIssuanceID: '00',
  Hodler: 'r...', // compiles: excess-property check is defeated by the index signature
}

// ---------------------------------------------------------------------------
// AUDIT-005: ledger_entry never narrows `node` by the lookup field.
// ---------------------------------------------------------------------------
export async function audit005(): Promise<void> {
  const res = await client.request({ command: 'ledger_entry', mpt_issuance: issuanceId })
  // @ts-expect-error -- Property 'MPTokenMetadata' does not exist on type 'LedgerEntry'
  const metadata: string | undefined = res.result.node.MPTokenMetadata
  // AUDIT-018: declared required, absent at runtime for validated lookups.
  const current: number = res.result.ledger_current_index
}

// ---------------------------------------------------------------------------
// AUDIT-006: MPToken is not a member of the LedgerEntry union, so even a
// discriminant check cannot narrow to it.
// ---------------------------------------------------------------------------
export async function audit006(): Promise<void> {
  const res = await client.request({
    command: 'ledger_entry',
    mptoken: { mpt_issuance_id: issuanceId, account: wallet.classicAddress },
  })
  const node = res.result.node
  // @ts-expect-error -- This comparison appears to be unintentional: no overlap with 'MPToken'
  if (node.LedgerEntryType === 'MPToken') {
    // unreachable per the types
  }
  type _mptokenNotInUnion = Expect<Equal<Extract<LedgerEntry.LedgerEntry, { LedgerEntryType: 'MPToken' }>, never>>
}

// ---------------------------------------------------------------------------
// AUDIT-007: account_objects `type` filter does not narrow the result.
// ---------------------------------------------------------------------------
export async function audit007(): Promise<void> {
  const res = await client.request({ command: 'account_objects', account: wallet.classicAddress, type: 'mpt_issuance' })
  // @ts-expect-error -- Property 'MaximumAmount' does not exist on type 'AccountObject'
  const max: string | undefined = res.result.account_objects[0]?.MaximumAmount
}

// ---------------------------------------------------------------------------
// AUDIT-010: MPToken type has no Account field and requires MPTAmount.
// ---------------------------------------------------------------------------
export function audit010(token: LedgerEntry.MPToken): void {
  // @ts-expect-error -- Property 'Account' does not exist on type 'MPToken' (rippled always returns it)
  const holder: string = token.Account
  const amount: string = token.MPTAmount // compiles; undefined at runtime when the balance is 0
}

// ---------------------------------------------------------------------------
// AUDIT-011: MPTokenIssuance type lacks the synthetic `mpt_issuance_id` rippled
// injects into every JSON view of the entry.
// ---------------------------------------------------------------------------
export function audit011(issuance: LedgerEntry.MPTokenIssuance): void {
  // @ts-expect-error -- Property 'mpt_issuance_id' does not exist on type 'MPTokenIssuance'
  const id: string = issuance.mpt_issuance_id
}

// ---------------------------------------------------------------------------
// AUDIT-012: mpt_issuance_id is optional on the create metadata and there is no
// helper to derive it.
// ---------------------------------------------------------------------------
export async function audit012(): Promise<void> {
  const res = await client.submitAndWait(createTx, { wallet })
  const meta = res.result.meta
  if (typeof meta === 'object') {
    // @ts-expect-error -- Type 'string | undefined' is not assignable to type 'string'
    const id: string = meta.mpt_issuance_id
  }
}

// ---------------------------------------------------------------------------
// AUDIT-015 / AUDIT-026: mpt_holders (Clio) and ledger_accept (admin) are not
// in the Request union.
// ---------------------------------------------------------------------------
export async function audit015and026(): Promise<void> {
  // @ts-expect-error -- 'mpt_holders' is not assignable to the Request union
  await client.request({ command: 'mpt_holders', mpt_issuance_id: issuanceId })
  // @ts-expect-error -- 'ledger_accept' is not assignable to the Request union
  await client.request({ command: 'ledger_accept' })
}

// ---------------------------------------------------------------------------
// AUDIT-030: simulate() does not thread the transaction type through.
// ---------------------------------------------------------------------------
export async function audit030(): Promise<void> {
  const res = await client.simulate(setTx)
  // @ts-expect-error -- Property 'MPTokenIssuanceID' does not exist on every member of Transaction
  const id: string = res.result.tx_json.MPTokenIssuanceID
}

// ---------------------------------------------------------------------------
// AUDIT-032: feature RPC entries lack `vetoed` (and the vote/count fields).
// ---------------------------------------------------------------------------
export async function audit032(): Promise<void> {
  const res = await client.request({ command: 'feature' })
  for (const feature of Object.values(res.result.features)) {
    // @ts-expect-error -- Property 'vetoed' does not exist
    const vetoed: boolean | string = feature.vetoed
  }
}

// ---------------------------------------------------------------------------
// AUDIT-033: autofill returns the input type, so filled fields stay optional.
// ---------------------------------------------------------------------------
export async function audit033(): Promise<void> {
  const filled = await client.autofill(createTx)
  // @ts-expect-error -- Type 'number | undefined' is not assignable to type 'number'
  const seq: number = filled.Sequence
  // @ts-expect-error -- Type 'string | undefined' is not assignable to type 'string'
  const fee: string = filled.Fee
}

// ---------------------------------------------------------------------------
// AUDIT-017: Payment.Amount accepts MPTAmount, but `Amount` (the exported
// type) does not include it ("TODO: add MPTAmount to Amount once MPTv2 is
// released"), so any helper typed on `Amount` rejects MPT values, while the
// internal `isAmount()` guard admits MPT amounts yet narrows to `Amount`.
// ---------------------------------------------------------------------------
export function audit017(p: Payment): void {
  type PaymentAmount = Payment['Amount']
  type _paymentAcceptsMpt = Expect<Equal<Extract<PaymentAmount, { mpt_issuance_id: string }>, { mpt_issuance_id: string; value: string }>>
  const mpt = { mpt_issuance_id: issuanceId, value: '1' }
  // @ts-expect-error -- MPTAmount is not assignable to Amount
  const amount: import('xrpl').Amount = mpt
}
