import { Client, Payment, Wallet, xrpToDrops } from 'xrpl'

import { FUND_XRP, GENESIS_SEED, LEDGER_TICK_MS, SERVER_URL } from './env'

export interface Session {
  client: Client
  genesis: Wallet
  /** Stop the ledger closer and disconnect. */
  close(): Promise<void>
}

/**
 * Connect to the standalone node and start a background ticker that closes a
 * ledger every LEDGER_TICK_MS. Without it `submitAndWait` would never resolve
 * because a standalone rippled only closes ledgers on `ledger_accept`.
 */
export async function openSession(): Promise<Session> {
  const client = new Client(SERVER_URL)
  await client.connect()
  const genesis = Wallet.fromSeed(GENESIS_SEED)

  let closing = false
  const timer = setInterval(() => {
    if (!closing) {
      closeLedger(client).catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('ledger_accept failed', err)
      })
    }
  }, LEDGER_TICK_MS)

  return {
    client,
    genesis,
    async close() {
      closing = true
      clearInterval(timer)
      await client.disconnect()
    },
  }
}

/**
 * Close one ledger on a standalone node.
 *
 * AUDIT-026: `ledger_accept` (like every other admin-only command) is not a
 * member of the `Request` union, so `client.request({ command: 'ledger_accept' })`
 * is a compile error. The repo's own integration utils reach around the typed
 * surface via `client.connection.request`, and so do we.
 */
export async function closeLedger(client: Client): Promise<void> {
  await client.connection.request({ command: 'ledger_accept' })
}

/** Create and fund a wallet from the genesis account. Sequential on purpose (genesis Sequence). */
export async function fundWallet(session: Session, xrp = FUND_XRP): Promise<Wallet> {
  const wallet = Wallet.generate()
  const tx: Payment = {
    TransactionType: 'Payment',
    Account: session.genesis.classicAddress,
    Destination: wallet.classicAddress,
    Amount: xrpToDrops(xrp),
  }
  const res = await session.client.submitAndWait(tx, { wallet: session.genesis })
  const meta = res.result.meta
  if (typeof meta !== 'object' || meta.TransactionResult !== 'tesSUCCESS') {
    throw new Error(`funding ${wallet.classicAddress} failed: ${JSON.stringify(meta)}`)
  }
  return wallet
}

export async function fundWallets(session: Session, count: number): Promise<Wallet[]> {
  const out: Wallet[] = []
  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line no-await-in-loop -- genesis Sequence must advance in order
    out.push(await fundWallet(session))
  }
  return out
}
