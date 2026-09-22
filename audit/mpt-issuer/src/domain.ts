/**
 * `domain`: the permissioned-domain admission route (XLS-80 + MPT DomainID).
 *
 * Questions answered against the ledger:
 *   1. Does a holder with an accepted credential from the domain get to receive
 *      without an explicit issuer MPTokenAuthorize?
 *   2. Does revoking the credential (CredentialDelete) stop the holder from
 *      receiving / sending? (i.e. is "revoke credential" a usable ban?)
 *   3. Does MPTokenIssuanceSet with DomainID = 0x00…00 clear the domain, as
 *      rippled's tesSUCCESS in `probes.ts` suggests, even though the SDK's
 *      `isDomainID` rejects the all-zero value (AUDIT-038)?
 */
import { sign as keypairSign } from 'ripple-keypairs'
import {
  CredentialAccept,
  CredentialCreate,
  CredentialDelete,
  MPTokenIssuanceCreate,
  MPTokenIssuanceSet,
  PermissionedDomainSet,
  SubmittableTransaction,
  Wallet,
  encode,
  encodeForSigning,
} from 'xrpl'

import { optIn, pay } from './holders'
import { getIssuance, holderBalance } from './inspect'
import { Session, fundWallet, openSession } from './session'
import { requireMeta, submitObserve, submitOk } from './tx'

const CRED_TYPE = '4B5943' // "KYC"
const ZERO_HASH = '0'.repeat(64)

/**
 * Sign without going through `Wallet.sign`, which calls `validate()` and would
 * reject the transaction the SDK wrongly considers malformed.
 */
export function signBypassingValidate(tx: SubmittableTransaction, wallet: Wallet): string {
  const unsigned = { ...tx, SigningPubKey: wallet.publicKey }
  const signature = keypairSign(encodeForSigning(unsigned), wallet.privateKey)
  return encode({ ...unsigned, TxnSignature: signature })
}

async function createDomain(session: Session, owner: Wallet, credentialIssuer: string): Promise<string> {
  const tx: PermissionedDomainSet = {
    TransactionType: 'PermissionedDomainSet',
    Account: owner.classicAddress,
    AcceptedCredentials: [{ Credential: { Issuer: credentialIssuer, CredentialType: CRED_TYPE } }],
  }
  const applied = await submitOk(session.client, tx, owner)
  for (const node of applied.meta.AffectedNodes) {
    if ('CreatedNode' in node && node.CreatedNode.LedgerEntryType === 'PermissionedDomain') {
      return node.CreatedNode.LedgerIndex
    }
  }
  throw new Error('PermissionedDomainSet created no PermissionedDomain node')
}

async function main(): Promise<void> {
  const session = await openSession()
  const { client } = session
  const log = (label: string, value: unknown): void => {
    // eslint-disable-next-line no-console
    console.log(label.padEnd(66), value)
  }
  try {
    const issuer = await fundWallet(session)
    const domainA = await createDomain(session, issuer, issuer.classicAddress)
    const domainB = await createDomain(session, issuer, issuer.classicAddress)
    log('domain A / B', `${domainA.slice(0, 8)}… / ${domainB.slice(0, 8)}…`)

    const create: MPTokenIssuanceCreate = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: issuer.classicAddress,
      Flags: { tfMPTRequireAuth: true, tfMPTCanLock: true, tfMPTCanClawback: true, tfMPTCanTransfer: true },
      DomainID: domainA,
    }
    const created = await submitOk(client, create, issuer)
    const issuanceId = created.meta.mpt_issuance_id
    if (issuanceId === undefined) {
      throw new Error('no mpt_issuance_id')
    }
    log('issuance DomainID on ledger', (await getIssuance(client, issuanceId)).DomainID === domainA)

    // --- admission via credential ---
    const holder = await fundWallet(session)
    log('holder opts in', await optIn(session, issuanceId, holder))
    log('issuer pays holder: no credential, no authorize', await pay(session, issuanceId, issuer, holder.classicAddress, '10'))
    const credCreate: CredentialCreate = {
      TransactionType: 'CredentialCreate',
      Account: issuer.classicAddress,
      Subject: holder.classicAddress,
      CredentialType: CRED_TYPE,
    }
    log('issuer creates credential', await submitObserve(client, credCreate, issuer))
    log('issuer pays holder: credential created, not accepted', await pay(session, issuanceId, issuer, holder.classicAddress, '10'))
    const credAccept: CredentialAccept = {
      TransactionType: 'CredentialAccept',
      Account: holder.classicAddress,
      Issuer: issuer.classicAddress,
      CredentialType: CRED_TYPE,
    }
    log('holder accepts credential', await submitObserve(client, credAccept, holder))
    log('issuer pays holder: credential accepted (no MPTokenAuthorize ever)', await pay(session, issuanceId, issuer, holder.classicAddress, '10'))
    log('holder balance', await holderBalance(client, issuanceId, holder.classicAddress))

    const holder2 = await fundWallet(session)
    log('holder2 opts in', await optIn(session, issuanceId, holder2))
    log('holder pays holder2 (holder2 has no credential)', await pay(session, issuanceId, holder, holder2.classicAddress, '1'))

    // --- revocation as a ban ---
    const credDelete: CredentialDelete = {
      TransactionType: 'CredentialDelete',
      Account: issuer.classicAddress,
      Subject: holder.classicAddress,
      Issuer: issuer.classicAddress,
      CredentialType: CRED_TYPE,
    }
    log('issuer revokes credential', await submitObserve(client, credDelete, issuer))
    log('issuer pays holder after revocation', await pay(session, issuanceId, issuer, holder.classicAddress, '1'))
    log('holder redeems to issuer after revocation', await pay(session, issuanceId, holder, issuer.classicAddress, '1'))
    log('holder balance after revocation', await holderBalance(client, issuanceId, holder.classicAddress))

    // --- DomainID changes ---
    const setB: MPTokenIssuanceSet = { TransactionType: 'MPTokenIssuanceSet', Account: issuer.classicAddress, MPTokenIssuanceID: issuanceId, DomainID: domainB }
    log('switch to domain B (SDK path)', await submitObserve(client, setB, issuer))
    log('issuance DomainID == B', (await getIssuance(client, issuanceId)).DomainID === domainB)

    const setZero: MPTokenIssuanceSet = { TransactionType: 'MPTokenIssuanceSet', Account: issuer.classicAddress, MPTokenIssuanceID: issuanceId, DomainID: ZERO_HASH }
    log('DomainID = 0x00..00 via SDK submitAndWait', await submitObserve(client, setZero, issuer).catch((err: unknown) => err instanceof Error ? `${err.constructor.name}: ${err.message}` : String(err)))
    const filled = await client.autofill({ ...setZero, DomainID: domainB }) // autofill with a value the SDK accepts…
    const blob = signBypassingValidate({ ...filled, DomainID: ZERO_HASH }, issuer) // …then swap in the zero hash and sign manually
    const res = await client.submitAndWait(blob)
    log('DomainID = 0x00..00 signed manually (bypassing validate)', requireMeta(res).TransactionResult)
    const after = await getIssuance(client, issuanceId)
    log('issuance DomainID after zero-set', after.DomainID === undefined ? 'absent (cleared)' : after.DomainID)
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
