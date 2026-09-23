import type { Autofilled, SubmittableTransaction } from '../models/transactions'

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
}
