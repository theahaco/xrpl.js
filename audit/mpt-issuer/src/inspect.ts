import { Client, LedgerEntry, RippledError, parseMPTokenIssuanceFlags } from 'xrpl'

import { mptIssuanceIndex, mptokenIndex } from './ids'
import { openSession } from './session'

/**
 * AUDIT-031: `import { MPToken, MPTokenIssuance } from 'xrpl'` fails with
 * "has no exported member" (the compiler even suggests `MPTokenIssuanceSet`).
 * Ledger-entry types live under the `LedgerEntry` namespace, while the
 * matching helper `parseMPTokenIssuanceFlags` is a top-level export and the
 * repo's own integration tests deep-import from `src/models/ledger/...`
 * instead of using the namespace.
 */
type MPToken = LedgerEntry.MPToken
type MPTokenIssuance = LedgerEntry.MPTokenIssuance
type MPTokenIssuanceFlagsInterface = LedgerEntry.MPTokenIssuanceFlagsInterface
type AnyLedgerEntry = LedgerEntry.LedgerEntry

/**
 * MPToken (holder entry) ledger flags, as defined in rippled `LedgerFormats.h`.
 *
 * AUDIT-009: `MPTokenIssuance` ships `MPTokenIssuanceFlags` +
 * `parseMPTokenIssuanceFlags`, but the holder-side `MPToken` type is just
 * `Flags: number` with no enum, interface, or parser, so reading
 * `lsfMPTLocked` / `lsfMPTAuthorized` means hand-rolling the bit values.
 */
export enum MPTokenFlags {
  lsfMPTLocked = 0x00000001,
  lsfMPTAuthorized = 0x00000002,
}

export interface MPTokenFlagsInterface {
  lsfMPTLocked?: boolean
  lsfMPTAuthorized?: boolean
}

export function parseMPTokenFlags(flags: number): MPTokenFlagsInterface {
  const out: MPTokenFlagsInterface = {}
  // eslint-disable-next-line no-bitwise
  if ((flags & MPTokenFlags.lsfMPTLocked) !== 0) {
    out.lsfMPTLocked = true
  }
  // eslint-disable-next-line no-bitwise
  if ((flags & MPTokenFlags.lsfMPTAuthorized) !== 0) {
    out.lsfMPTAuthorized = true
  }
  return out
}

/**
 * What rippled actually returns for an `MPTokenIssuance` entry, on top of the
 * SDK's `MPTokenIssuance` type.
 *
 * AUDIT-011: rippled injects a synthetic `mpt_issuance_id` into every
 * MPTokenIssuance JSON (ledger_entry, account_objects, ledger_data) and the SDK
 * type omits it, so the repo's own tests cast to `{ mpt_issuance_id?: string }`.
 */
export type MPTokenIssuanceOnLedger = MPTokenIssuance & { mpt_issuance_id?: string }

/**
 * AUDIT-035: a `ledger_entry` miss surfaces as a thrown `RippledError` whose
 * machine-readable code lives in `err.data.error`, but `XrplError.data` is
 * typed `unknown`, so telling "not found" apart from a real failure needs a
 * hand-written structural guard (the message is only "Entry not found.").
 */
function isNotFound(err: unknown): boolean {
  if (!(err instanceof RippledError)) {
    return false
  }
  const data: unknown = err.data
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    (data.error === 'entryNotFound' || data.error === 'objectNotFound')
  )
}

/** Read the issuance via `ledger_entry` + `mpt_issuance`. */
export async function getIssuance(client: Client, issuanceId: string): Promise<MPTokenIssuanceOnLedger> {
  const res = await client.request({
    command: 'ledger_entry',
    mpt_issuance: issuanceId,
    ledger_index: 'validated',
  })
  // AUDIT-005: `node` is the full LedgerEntry union even though the request
  // named `mpt_issuance`; the discriminant check below is the cheapest way
  // to narrow. It only works because MPTokenIssuance is a union member.
  const node: AnyLedgerEntry = res.result.node
  if (node.LedgerEntryType !== 'MPTokenIssuance') {
    throw new Error(`expected MPTokenIssuance, got ${node.LedgerEntryType}`)
  }
  return node
}

/** Read a holder's MPToken via `ledger_entry` + `mptoken`, or undefined when absent. */
export async function getMPToken(
  client: Client,
  issuanceId: string,
  account: string,
): Promise<MPToken | undefined> {
  try {
    const res = await client.request({
      command: 'ledger_entry',
      mptoken: { mpt_issuance_id: issuanceId, account },
      ledger_index: 'validated',
    })
    // AUDIT-006: `MPToken` is not a member of the `LedgerEntry` union, so
    // `res.result.node.LedgerEntryType === 'MPToken'` can never narrow and a
    // double cast is forced (the repo's clawback test uses @ts-expect-error).
    return res.result.node as unknown as MPToken
  } catch (err) {
    if (isNotFound(err)) {
      return undefined
    }
    throw err
  }
}

/** Convenience: issuance flags as booleans. */
export async function issuanceFlags(client: Client, issuanceId: string): Promise<MPTokenIssuanceFlagsInterface> {
  return parseMPTokenIssuanceFlags((await getIssuance(client, issuanceId)).Flags)
}

/** Convenience: holder balance as a string ("0" when the entry omits MPTAmount or does not exist). */
export async function holderBalance(client: Client, issuanceId: string, account: string): Promise<string> {
  const token = await getMPToken(client, issuanceId, account)
  // AUDIT-010: `MPToken.MPTAmount` is typed as a required string, but rippled
  // omits default-valued (zero) fields, so a fresh or fully clawed-back holder
  // entry has no MPTAmount at all. The `??` below is unreachable per the types.
  return token?.MPTAmount ?? '0'
}

/** `account_objects` filtered to a holder's MPTokens. */
export async function listHolderTokens(client: Client, account: string): Promise<MPToken[]> {
  const res = await client.request({
    command: 'account_objects',
    account,
    type: 'mptoken',
    ledger_index: 'validated',
  })
  // AUDIT-007: `type: 'mptoken'` does not narrow `account_objects`, and
  // AUDIT-006 means MPToken is not even in the union being filtered.
  return res.result.account_objects as unknown as MPToken[]
}

/** `account_objects` filtered to an issuer's issuances. */
export async function listIssuances(client: Client, account: string): Promise<MPTokenIssuanceOnLedger[]> {
  const res = await client.request({
    command: 'account_objects',
    account,
    type: 'mpt_issuance',
    ledger_index: 'validated',
  })
  // AUDIT-007: no narrowing by `type`, so a filter + cast is needed even
  // though MPTokenIssuance is in the union.
  return res.result.account_objects.filter(
    (obj): obj is MPTokenIssuanceOnLedger => obj.LedgerEntryType === 'MPTokenIssuance',
  )
}

/**
 * Try the Clio-only `mpt_holders` method against whatever node we're talking to.
 *
 * AUDIT-015: the SDK has no request/response type for `mpt_holders` at all, so
 * this cannot go through `client.request` without a cast.
 */
export async function tryMptHolders(client: Client, issuanceId: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res: unknown = await client.connection.request({
      command: 'mpt_holders',
      mpt_issuance_id: issuanceId,
      ledger_index: 'validated',
    })
    return { ok: true, detail: JSON.stringify(res).slice(0, 200) }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

/** Print everything we can read about one issuance and (optionally) one holder. */
export async function inspect(client: Client, issuanceId: string, holder?: string): Promise<void> {
  const issuance = await getIssuance(client, issuanceId)
  const raw = await client.request({ command: 'ledger_entry', mpt_issuance: issuanceId, ledger_index: 'validated' })
  const entryIndex = raw.result.index
  // AUDIT-018: the response type declares `ledger_current_index: number` as
  // required, but a lookup against `ledger_index: 'validated'` returns
  // `ledger_index` + `ledger_hash` instead. Print the keys to prove it.
  // eslint-disable-next-line no-console
  console.log('ledger_entry result keys (validated lookup):', Object.keys(raw.result).sort().join(', '),
    '| ledger_current_index =', raw.result.ledger_current_index)
  // eslint-disable-next-line no-console
  console.log('MPTokenIssuance', {
    index: entryIndex,
    derivedIndex: mptIssuanceIndex(issuanceId),
    indexMatches: entryIndex === mptIssuanceIndex(issuanceId),
    mpt_issuance_id: issuance.mpt_issuance_id,
    Issuer: issuance.Issuer,
    Sequence: issuance.Sequence,
    Flags: issuance.Flags,
    flags: parseMPTokenIssuanceFlags(issuance.Flags),
    OutstandingAmount: issuance.OutstandingAmount,
    MaximumAmount: issuance.MaximumAmount,
    AssetScale: issuance.AssetScale,
    DomainID: issuance.DomainID,
    ImmutableFlags: issuance.ImmutableFlags,
  })
  if (holder !== undefined) {
    const token = await getMPToken(client, issuanceId, holder)
    // eslint-disable-next-line no-console
    console.log('MPToken', holder, token === undefined ? '(none)' : {
      derivedIndex: mptokenIndex(issuanceId, holder),
      raw: token,
      flags: parseMPTokenFlags(token.Flags),
    })
  }
  // eslint-disable-next-line no-console
  console.log('mpt_holders:', await tryMptHolders(client, issuanceId))
}

async function main(): Promise<void> {
  const [issuanceId, holder] = process.argv.slice(2)
  if (issuanceId === undefined) {
    // eslint-disable-next-line no-console
    console.error('usage: npm run inspect -- <MPTokenIssuanceID> [holderAddress]')
    process.exitCode = 2
    return
  }
  const session = await openSession()
  try {
    await inspect(session.client, issuanceId, holder)
  } finally {
    await session.close()
  }
}

if (require.main === module) {
  main().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error(err)
    process.exitCode = 1
  })
}
