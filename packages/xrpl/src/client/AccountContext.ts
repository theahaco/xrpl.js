import { ValidationError } from '../errors'
import { isValidClassicAddress } from '../utils'
import type { Wallet } from '../Wallet'

import {
  createTransactionBuilders,
  TransactionBuilders,
} from './TransactionBuilder'

import type { Client } from '.'

/** A local signing scope on a shared connection. */
export interface WalletContext {
  readonly address: string
  readonly wallet: Wallet
  readonly tx: TransactionBuilders
}

/** Account-bound drafts on an existing connection; no private key is needed. */
export class AccountContext {
  public readonly address: string

  /** Discover all transaction types for this account. */
  public readonly tx: TransactionBuilders<false>

  private readonly client: Client

  /**
   * Create an account scope without opening a connection.
   *
   * @param client - Existing connection and request settings.
   * @param address - Default transaction account.
   */
  public constructor(client: Client, address: string) {
    if (!isValidClassicAddress(address)) {
      throw new ValidationError('Expected a valid classic account address.')
    }
    this.client = client
    this.address = address
    this.tx = createTransactionBuilders(client, address)
  }

  /**
   * Use a local wallet to sign for this account, including a regular-key wallet.
   *
   * @param wallet - Signing wallet; it does not replace the bound account.
   * @returns A signing scope on the same connection.
   */
  public withWallet(wallet: Wallet): WalletContext {
    return Object.freeze({
      address: this.address,
      wallet,
      tx: createTransactionBuilders(this.client, this.address, wallet),
    })
  }
}
