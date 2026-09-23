import { ValidationError } from '../errors'
import type { Wallet } from '../Wallet'

import {
  createTransactionBuilders,
  TransactionBuilders,
} from './TransactionBuilder'

import { Client, ClientOptions } from '.'

/** Client settings with a required signing wallet. */
export interface WalletClientOptions extends ClientOptions {
  wallet: Wallet
}

/**
 * A client with a signing wallet and discoverable transaction builders.
 *
 * @example
 * ```ts
 * const client = new WalletClient(server, { wallet })
 * await client.connect()
 * const response = await client.tx.payment({
 *   Amount: xrpToDrops('1'),
 *   Destination: recipient.address,
 * }).signAndSubmit()
 * console.log(response.result.hash)
 * ```
 */
export class WalletClient extends Client {
  /** Wallet used when a submission does not explicitly provide another signer. */
  declare public readonly wallet: Wallet

  /** Discover all modeled transactions; factories create drafts without sending them. */
  public readonly tx: TransactionBuilders

  /**
   * Create a connection with a required signing wallet.
   *
   * @param server - WebSocket server URL.
   * @param options - Connection settings and signing wallet.
   */
  public constructor(server: string, options: WalletClientOptions) {
    super(server, options)
    // JavaScript callers can omit the wallet despite the required TypeScript field.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Validate JavaScript callers too.
    if (options?.wallet == null) {
      throw new ValidationError('WalletClient requires a signing wallet.')
    }
    this.tx = createTransactionBuilders(
      this,
      options.wallet.address,
      options.wallet,
    )
  }
}
