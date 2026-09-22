/**
 * `probes`: for each malformed (or edge-case) MPT transaction, what does the
 * SDK's `validate()` say versus what rippled's `simulate` says?
 *
 * The interesting rows are the ones where `validate()` returns "ok" and
 * rippled returns `tem*` — every such row is a client-side check the SDK
 * could have made before spending a round trip (or, with `submit`, a fee).
 */
import {
  Clawback,
  MPTokenAuthorize,
  MPTokenAuthorizeFlags,
  MPTokenIssuanceCreate,
  MPTokenIssuanceCreateFlags,
  MPTokenIssuanceSet,
  MPTokenIssuanceSetFlags,
  Payment,
  PaymentFlags,
  SubmittableTransaction,
  Wallet,
  validate,
} from 'xrpl'

import { onboardHolder } from './holders'
import { issueToken } from './issue'
import { Session, fundWallet, openSession } from './session'

const ZERO_HASH = '0'.repeat(64)

export interface ProbeRow {
  name: string
  validate: string
  rippled: string
}

function validateOnly(tx: SubmittableTransaction): string {
  try {
    validate(tx)
    return 'ok'
  } catch (err) {
    return err instanceof Error ? `${err.constructor.name}: ${err.message}` : String(err)
  }
}

async function simulateOnly(session: Session, tx: SubmittableTransaction): Promise<string> {
  try {
    const res = await session.client.simulate(tx)
    return res.result.engine_result
  } catch (err) {
    return err instanceof Error ? `${err.constructor.name}: ${err.message}` : String(err)
  }
}

interface Fixture {
  issuer: Wallet
  issuanceId: string
  /** An issuance created without tfMPTCanLock / tfMPTCanClawback / RequireAuth. */
  plainIssuanceId: string
  holder: Wallet
  stranger: Wallet
}

/* eslint-disable no-bitwise -- flag arithmetic is the point */
function cases(f: Fixture): Array<{ name: string; tx: SubmittableTransaction }> {
  const issuer = f.issuer.classicAddress
  const holder = f.holder.classicAddress
  const stranger = f.stranger.classicAddress
  const auth = (extra: Partial<MPTokenAuthorize>, account = holder): MPTokenAuthorize =>
    ({ TransactionType: 'MPTokenAuthorize', Account: account, MPTokenIssuanceID: f.issuanceId, ...extra })
  const set = (extra: Partial<MPTokenIssuanceSet>, id = f.issuanceId): MPTokenIssuanceSet =>
    ({ TransactionType: 'MPTokenIssuanceSet', Account: issuer, MPTokenIssuanceID: id, ...extra })
  const create = (extra: Partial<MPTokenIssuanceCreate>): MPTokenIssuanceCreate =>
    ({ TransactionType: 'MPTokenIssuanceCreate', Account: issuer, ...extra })
  const claw = (extra: Partial<Clawback>): Clawback =>
    ({ TransactionType: 'Clawback', Account: issuer, Amount: { mpt_issuance_id: f.issuanceId, value: '1' }, Holder: holder, ...extra })
  const payment = (extra: Partial<Payment>, from = issuer): Payment =>
    ({ TransactionType: 'Payment', Account: from, Destination: holder, Amount: { mpt_issuance_id: f.issuanceId, value: '1' }, ...extra })

  return [
    // MPTokenAuthorize
    { name: 'Authorize: Holder == Account', tx: auth({ Account: issuer, Holder: issuer }) },
    { name: 'Authorize: unknown flag bit 0x2', tx: auth({ Flags: 0x2 }) },
    { name: 'Authorize: issuer opts into own issuance (no Holder)', tx: auth({}, issuer) },
    { name: 'Authorize: non-issuer supplies Holder', tx: auth({ Holder: stranger }, holder) },
    { name: 'Authorize: issuer tfMPTUnauthorize w/o Holder', tx: auth({ Flags: MPTokenAuthorizeFlags.tfMPTUnauthorize }, issuer) },
    { name: 'Authorize: holder opts in twice', tx: auth({}) },
    { name: 'Authorize: holder opt-out with balance', tx: auth({ Flags: MPTokenAuthorizeFlags.tfMPTUnauthorize }) },
    { name: 'Authorize: bad MPTokenIssuanceID length', tx: auth({ MPTokenIssuanceID: 'ABCD' }) },
    // MPTokenIssuanceSet
    { name: 'Set: tfMPTLock | tfMPTUnlock', tx: set({ Flags: MPTokenIssuanceSetFlags.tfMPTLock | MPTokenIssuanceSetFlags.tfMPTUnlock }) },
    { name: 'Set: Holder + DomainID', tx: set({ Holder: holder, DomainID: ZERO_HASH }) },
    { name: 'Set: Holder == Account', tx: set({ Holder: issuer, Flags: MPTokenIssuanceSetFlags.tfMPTLock }) },
    { name: 'Set: no flags, no fields', tx: set({}) },
    { name: 'Set: unknown flag bit 0x8000', tx: set({ Flags: 0x8000 }) },
    { name: 'Set: Flags 0 with Holder', tx: set({ Holder: holder, Flags: 0 }) },
    { name: 'Set: tfMPTLock on issuance without CanLock', tx: set({ Flags: MPTokenIssuanceSetFlags.tfMPTLock }, f.plainIssuanceId) },
    { name: 'Set: tfMPTSetCanTrade on pinned (immutable) issuance', tx: set({ Flags: MPTokenIssuanceSetFlags.tfMPTSetCanTrade }) },
    { name: 'Set: DomainID + tfMPTLock', tx: set({ DomainID: ZERO_HASH, Flags: MPTokenIssuanceSetFlags.tfMPTLock }) },
    { name: 'Set: TransferFee 60000', tx: set({ TransferFee: 60000 }) },
    { name: 'Set: TransferFee on issuance without CanTransfer', tx: set({ TransferFee: 100 }, f.plainIssuanceId) },
    { name: 'Set: MPTokenMetadata not hex', tx: set({ MPTokenMetadata: 'zz' }) },
    { name: 'Set: ImmutableFlags 0', tx: set({ ImmutableFlags: 0 }) },
    { name: 'Set: lock a Holder with no MPToken', tx: set({ Holder: stranger, Flags: MPTokenIssuanceSetFlags.tfMPTLock }) },
    { name: 'Set: non-issuer locks', tx: { ...set({ Flags: MPTokenIssuanceSetFlags.tfMPTLock }), Account: holder } },
    // MPTokenIssuanceCreate
    { name: 'Create: Flags 0x1 (lsfMPTLocked bit)', tx: create({ Flags: 0x1 }) },
    { name: 'Create: TransferFee without CanTransfer', tx: create({ TransferFee: 100 }) },
    { name: 'Create: TransferFee 0 without CanTransfer', tx: create({ TransferFee: 0 }) },
    { name: 'Create: AssetScale 300', tx: create({ AssetScale: 300 }) },
    { name: 'Create: AssetScale -1', tx: create({ AssetScale: -1 }) },
    { name: 'Create: MaximumAmount "0"', tx: create({ MaximumAmount: '0' }) },
    { name: 'Create: MaximumAmount 2^63', tx: create({ MaximumAmount: '9223372036854775808' }) },
    { name: 'Create: DomainID without RequireAuth', tx: create({ DomainID: ZERO_HASH }) },
    { name: 'Create: DomainID (nonexistent) with RequireAuth', tx: create({ DomainID: ZERO_HASH, Flags: MPTokenIssuanceCreateFlags.tfMPTRequireAuth }) },
    { name: 'Create: ImmutableFlags 0', tx: create({ ImmutableFlags: 0 }) },
    { name: 'Create: ImmutableFlags unknown bit 0x100', tx: create({ ImmutableFlags: 0x100 }) },
    { name: 'Create: MPTokenMetadata empty string', tx: create({ MPTokenMetadata: '' }) },
    { name: 'Create: MPTokenMetadata 1025 bytes', tx: create({ MPTokenMetadata: 'AB'.repeat(1025) }) },
    // Clawback
    { name: 'Clawback: value "0"', tx: claw({ Amount: { mpt_issuance_id: f.issuanceId, value: '0' } }) },
    { name: 'Clawback: unknown flag bit 0x1', tx: claw({ Flags: 0x1 }) },
    { name: 'Clawback: Holder with no MPToken', tx: claw({ Holder: stranger }) },
    { name: 'Clawback: on issuance without CanClawback', tx: claw({ Amount: { mpt_issuance_id: f.plainIssuanceId, value: '1' } }) },
    // Payment with MPT amounts
    { name: 'Payment: MPT to self', tx: payment({ Destination: issuer }) },
    { name: 'Payment: MPT with tfPartialPayment', tx: payment({ Flags: PaymentFlags.tfPartialPayment }) },
    { name: 'Payment: MPT Amount + XRP SendMax', tx: payment({ SendMax: '1000' }) },
    { name: 'Payment: MPT Amount + DeliverMin, no partial flag', tx: payment({ DeliverMin: { mpt_issuance_id: f.issuanceId, value: '1' } }) },
    { name: 'Payment: MPT value "0"', tx: payment({ Amount: { mpt_issuance_id: f.issuanceId, value: '0' } }) },
    { name: 'Payment: MPT to stranger with no MPToken', tx: payment({ Destination: stranger }) },
    { name: 'Payment: MPT with Paths', tx: payment({ Paths: [[{ currency: 'USD', issuer: stranger }]] }) },
    { name: 'Payment: DeliverMax (RPC-only alias) with MPT', tx: payment({ DeliverMax: { mpt_issuance_id: f.issuanceId, value: '1' } }) },
  ]
}
/* eslint-enable no-bitwise */

export async function runProbes(session: Session): Promise<ProbeRow[]> {
  const { issuer, issuanceId } = await issueToken(session)
  // A second, capability-less issuance from the same issuer.
  const plainCreate: MPTokenIssuanceCreate = { TransactionType: 'MPTokenIssuanceCreate', Account: issuer.classicAddress }
  const plainRes = await session.client.submitAndWait(plainCreate, { wallet: issuer })
  const plainMeta = plainRes.result.meta
  const plainIssuanceId = typeof plainMeta === 'object' ? plainMeta.mpt_issuance_id : undefined
  if (plainIssuanceId === undefined) {
    throw new Error('plain issuance did not return an id')
  }
  const holder = await onboardHolder(session, issuanceId, issuer, '100')
  const stranger = await fundWallet(session)
  const fixture: Fixture = { issuer, issuanceId, plainIssuanceId, holder, stranger }

  const rows: ProbeRow[] = []
  for (const probe of cases(fixture)) {
    // eslint-disable-next-line no-await-in-loop -- sequential for readable output
    rows.push({ name: probe.name, validate: validateOnly(probe.tx), rippled: await simulateOnly(session, probe.tx) })
  }
  return rows
}

async function main(): Promise<void> {
  const session = await openSession()
  try {
    const rows = await runProbes(session)
    const w = Math.max(...rows.map((row) => row.name.length))
    for (const row of rows) {
      const gap = row.validate === 'ok' && /^tem|Error/u.test(row.rippled) ? '  <-- SDK could catch' : ''
      // eslint-disable-next-line no-console
      console.log(`${row.name.padEnd(w)} | validate: ${row.validate.padEnd(90)} | rippled: ${row.rippled}${gap}`)
    }
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
