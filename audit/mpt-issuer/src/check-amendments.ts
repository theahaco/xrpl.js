/**
 * Verify which MPT-relevant amendments are *in effect* on the standalone node.
 *
 * AUDIT-020: the `feature` admin RPC only reflects the on-ledger Amendments
 * object. In standalone mode the `[features]` stanza works as a set of rule
 * presets, which `feature` reports as `enabled: false` and `vetoed: true` for
 * every entry, even though transactions gated on them succeed. The only
 * reliable probe is behavioural: `simulate` a gated transaction and look for
 * `temDISABLED`.
 */
import { Client, SubmittableTransaction } from 'xrpl'

import { GENESIS_ADDRESS } from './env'
import { openSession } from './session'

const ZERO_ID = '00000000' + '0'.repeat(40)
const ZERO_HASH = '0'.repeat(64)

interface Probe {
  amendment: string
  tx: SubmittableTransaction
}

/** Each probe is a transaction whose preflight returns temDISABLED when its amendment is off. */
const PROBES: Probe[] = [
  {
    amendment: 'MPTokensV1',
    tx: { TransactionType: 'MPTokenIssuanceCreate', Account: GENESIS_ADDRESS },
  },
  {
    amendment: 'DynamicMPT (MPTokenIssuanceSet mutation)',
    tx: {
      TransactionType: 'MPTokenIssuanceSet',
      Account: GENESIS_ADDRESS,
      MPTokenIssuanceID: ZERO_ID,
      MPTokenMetadata: '7B7D',
    },
  },
  {
    amendment: 'Clawback (MPT amount)',
    tx: {
      TransactionType: 'Clawback',
      Account: GENESIS_ADDRESS,
      Amount: { mpt_issuance_id: ZERO_ID, value: '1' },
      Holder: 'rrrrrrrrrrrrrrrrrrrrBZbvji',
    },
  },
  {
    amendment: 'PermissionedDomains',
    tx: {
      TransactionType: 'PermissionedDomainSet',
      Account: GENESIS_ADDRESS,
      AcceptedCredentials: [
        { Credential: { Issuer: GENESIS_ADDRESS, CredentialType: '4B5943' } },
      ],
    },
  },
  {
    amendment: 'Credentials',
    tx: {
      TransactionType: 'CredentialCreate',
      Account: GENESIS_ADDRESS,
      Subject: 'rrrrrrrrrrrrrrrrrrrrBZbvji',
      CredentialType: '4B5943',
    },
  },
  {
    amendment: 'PermissionedDomains + MPTokensV1 (DomainID on MPTokenIssuanceSet)',
    tx: {
      TransactionType: 'MPTokenIssuanceSet',
      Account: GENESIS_ADDRESS,
      MPTokenIssuanceID: ZERO_ID,
      DomainID: ZERO_HASH,
    },
  },
]

export interface AmendmentStatus {
  amendment: string
  engineResult: string
  inEffect: boolean
}

export async function probeAmendments(client: Client): Promise<AmendmentStatus[]> {
  const out: AmendmentStatus[] = []
  for (const probe of PROBES) {
    // eslint-disable-next-line no-await-in-loop -- sequential for readable output
    const res = await client.simulate(probe.tx)
    // AUDIT-030: `client.simulate` returns `SimulateJsonResponse` with the
    // default `Transaction` type parameter; nothing threads the input tx type
    // through, so `res.result.tx_json` is the ~70-member union.
    const engineResult = res.result.engine_result
    out.push({ amendment: probe.amendment, engineResult, inEffect: engineResult !== 'temDISABLED' })
  }
  return out
}

/** What the `feature` RPC says, for comparison. */
export async function featureRpcView(client: Client, names: string[]): Promise<Record<string, string>> {
  const res = await client.request({ command: 'feature' })
  const byName = new Map<string, { enabled: boolean; vetoed: boolean | string | undefined }>()
  for (const feature of Object.values(res.result.features)) {
    // AUDIT-032: `FeatureAllResponse` types each entry as
    // `{ enabled, name, supported }`; rippled also returns `vetoed`
    // (boolean | "Obsolete") and, for un-enabled amendments, `count`,
    // `threshold`, `validations`, `vote`. Reading `vetoed` needs a cast.
    const vetoed = (feature as { vetoed?: boolean | string }).vetoed
    byName.set(feature.name, { enabled: feature.enabled, vetoed })
  }
  const view: Record<string, string> = {}
  for (const name of names) {
    const feature = byName.get(name)
    view[name] = feature === undefined ? 'absent' : `enabled=${feature.enabled} vetoed=${String(feature.vetoed)}`
  }
  return view
}

async function main(): Promise<void> {
  const session = await openSession()
  try {
    const info = await session.client.request({ command: 'server_info' })
    // eslint-disable-next-line no-console
    console.log('rippled', info.result.info.build_version, 'at', session.client.url)

    const statuses = await probeAmendments(session.client)
    // eslint-disable-next-line no-console
    console.log('\nBehavioural probe (simulate → engine_result):')
    for (const status of statuses) {
      // eslint-disable-next-line no-console
      console.log(`  ${status.inEffect ? 'IN EFFECT ' : 'DISABLED  '} ${status.amendment.padEnd(60)} ${status.engineResult}`)
    }

    const names = ['MPTokensV1', 'DynamicMPT', 'Clawback', 'PermissionedDomains', 'Credentials', 'fixMPTDeliveredAmount', 'Sponsor']
    // eslint-disable-next-line no-console
    console.log('\n`feature` RPC view of the same amendments:')
    for (const [name, value] of Object.entries(await featureRpcView(session.client, names))) {
      // eslint-disable-next-line no-console
      console.log(`  ${name.padEnd(24)} ${value}`)
    }

    const missing = statuses.filter((status) => !status.inEffect)
    if (missing.length > 0) {
      process.exitCode = 1
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
