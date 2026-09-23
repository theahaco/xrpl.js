import type { SubmitResult, SuccessfulTxResponse } from '../models/methods'
import type { Autofilled, SubmittableTransaction } from '../models/transactions'
import type { Wallet } from '../Wallet'

import { MultisigOptions, PreparedMultisig } from './PreparedMultisig'

import type { Client } from '.'

/** An account-bound draft with no assumption about who owns its private keys. */
export class TransactionDraft<T extends SubmittableTransaction> {
  protected readonly client: Client

  private readonly draft: T

  /**
   * Capture an independent draft. Creating a draft never sends a transaction.
   *
   * @param client - Connection used for preparation and submission.
   * @param transaction - Complete transaction draft.
   */
  public constructor(client: Client, transaction: T) {
    this.client = client
    this.draft = structuredClone(transaction)
  }

  /**
   * Inspect an independent copy including Account and TransactionType.
   *
   * @returns A copy of the draft.
   */
  public toJSON(): T {
    return structuredClone(this.draft)
  }

  /**
   * Fill the fee, sequence and bounded expiry for an external single signer.
   * No signature is requested and nothing is submitted.
   *
   * @returns An independent prepared transaction.
   */
  public async prepare(): Promise<Autofilled<T>> {
    return this.client.autofill<T>(this.toJSON())
  }

  /**
   * Freeze fee, sequence and expiry for local or external multisigners.
   *
   * @param options - Expected signature count (not weighted quorum) and expiry.
   * @returns An immutable prepared multisig payload.
   */
  public async prepareMultisig(
    options: MultisigOptions,
  ): Promise<PreparedMultisig<T>> {
    return PreparedMultisig.prepare(this.client, this.toJSON(), options)
  }

  /**
   * Prepare once, co-sign with local wallets and await validated success.
   *
   * @param wallets - Actual signers; the ledger checks their authority and quorum.
   * @returns The successful transaction response.
   */
  public async multisignAndSubmit(
    wallets: readonly Wallet[],
  ): Promise<SuccessfulTxResponse<T>> {
    const prepared = await this.prepareMultisig({
      signersCount: wallets.length,
    })
    return wallets.reduce((tx, wallet) => tx.sign(wallet), prepared).submit()
  }

  /**
   * Prepare and locally co-sign with an explicit success/error outcome.
   *
   * @param wallets - Local signing wallets.
   * @returns A result including preparation, signing and submission errors.
   */
  public async tryMultisignAndSubmit(
    wallets: readonly Wallet[],
  ): Promise<SubmitResult<T>> {
    try {
      return { ok: true, response: await this.multisignAndSubmit(wallets) }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }
}
