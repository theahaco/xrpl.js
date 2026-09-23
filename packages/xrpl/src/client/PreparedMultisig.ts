import { decode, encode, encodeForMultisigning } from 'ripple-binary-codec'
import { verify } from 'ripple-keypairs'

import { ValidationError } from '../errors'
import type { Signer } from '../models/common'
import type { SubmitResult, SuccessfulTxResponse } from '../models/methods'
import {
  Autofilled,
  SubmittableTransaction,
  validate,
} from '../models/transactions'
import type { Wallet } from '../Wallet'
import { compareSigners } from '../Wallet/utils'

import type { Client } from '.'

const MAX_MULTISIGNERS = 32

export interface MultisigOptions {
  /** Maximum signatures to budget for. This is a count, not a weighted quorum. */
  signersCount: number
  /** Bounded by default. Unbounded external ceremonies must explicitly opt in. */
  expiry?: 'bounded' | 'none'
}

export type MultisigTransaction<T extends SubmittableTransaction> = Omit<
  Autofilled<T>,
  'LastLedgerSequence'
> & {
  LastLedgerSequence?: number
  SigningPubKey: ''
}

/**
 * Immutable multisig payload. Every signature covers the same fee, sequence and
 * expiry. Signature verification does not establish on-ledger signer authority
 * or weighted quorum; only ledger validation can establish success.
 */
export class PreparedMultisig<T extends SubmittableTransaction> {
  public readonly signersCount: number

  private readonly client: Client

  private readonly blob: string

  private constructor(client: Client, blob: string, signersCount: number) {
    this.client = client
    this.blob = blob
    this.signersCount = signersCount
    Object.freeze(this)
  }

  /**
   * Prepare once before any signer sees the payload.
   *
   * @param client - Connection used for fee, sequence and expiry lookup.
   * @param transaction - Unsigned transaction draft; omit Fee to budget safely.
   * @param options - Signature-count budget and explicit expiry policy.
   * @returns An immutable unsigned multisig payload.
   */
  public static async prepare<T extends SubmittableTransaction>(
    client: Client,
    transaction: T,
    options: MultisigOptions,
  ): Promise<PreparedMultisig<T>> {
    const { signersCount, expiry = 'bounded' } = options
    if (
      !Number.isInteger(signersCount) ||
      signersCount < 1 ||
      signersCount > MAX_MULTISIGNERS
    ) {
      throw new ValidationError('signersCount must be an integer from 1 to 32.')
    }
    if (
      transaction.Fee != null ||
      transaction.TxnSignature ||
      transaction.Signers
    ) {
      throw new ValidationError(
        'Prepare multisig before setting Fee or signatures.',
      )
    }
    const prepared = await client.autofill<T>(transaction, signersCount)
    const { LastLedgerSequence, ...fields } = prepared
    const payload = {
      ...fields,
      SigningPubKey: '',
      ...(expiry === 'none' ? {} : { LastLedgerSequence }),
    }
    validate(payload)
    return new PreparedMultisig<T>(client, encode(payload), signersCount)
  }

  /**
   * Inspect or hand off an independent JSON payload to an external signer.
   *
   * @returns The exact prepared payload, including any collected signatures.
   */
  public toJSON(): MultisigTransaction<T> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Encoded from the validated generic transaction.
    return decode(this.blob) as unknown as MultisigTransaction<T>
  }

  /**
   * Co-sign without changing the payload or the previous prepared instance.
   *
   * @param wallet - Local signing key.
   * @param signerAccount - Signer-list account; may differ for regular-key signing.
   * @returns A new instance containing this signature.
   */
  public sign(
    wallet: Wallet,
    signerAccount = wallet.address,
  ): PreparedMultisig<T> {
    const transaction = this.toJSON()
    delete transaction.Signers
    return this.addSignature(
      wallet.sign(
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Payload was validated before encoding.
        transaction as unknown as SubmittableTransaction,
        signerAccount,
      ).tx_blob,
    )
  }

  /**
   * Merge externally signed blobs only when payload and signatures are valid.
   * Rejects duplicate signers, altered payloads and signatures over another tx.
   *
   * @param blob - One or more co-signatures encoded with the original payload.
   * @returns A new instance; the original remains unchanged.
   * @throws ValidationError for altered payloads, duplicate or invalid signatures.
   */
  public addSignature(blob: string): PreparedMultisig<T> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Validate decoded structure before accepting it.
    const incoming = decode(blob) as unknown as SubmittableTransaction
    const current = this.toJSON()
    validate(incoming)
    if (
      incoming.SigningPubKey !== '' ||
      incoming.TxnSignature ||
      !incoming.Signers?.length
    ) {
      throw new ValidationError('Expected a multisigned transaction blob.')
    }
    const { Signers: incomingSigners, ...incomingPayload } = incoming
    const { Signers: currentSigners = [], ...currentPayload } = current
    if (encode(incomingPayload) !== encode(currentPayload)) {
      throw new ValidationError(
        'Signature payload differs from the prepared transaction.',
      )
    }
    const signers = [...currentSigners, ...incomingSigners]
    this.validateSigners(signers, currentPayload)
    signers.sort((left, right) => compareSigners(left.Signer, right.Signer))
    return new PreparedMultisig<T>(
      this.client,
      encode({ ...currentPayload, Signers: signers }),
      this.signersCount,
    )
  }

  /**
   * Export the collected signatures without submitting or changing any fields.
   *
   * @returns A signed blob for external submission.
   * @throws ValidationError when no signature has been collected.
   */
  public toBlob(): string {
    if (!this.toJSON().Signers?.length) {
      throw new ValidationError(
        'Collect at least one signature before exporting a signed blob.',
      )
    }
    return this.blob
  }

  /**
   * Submit the exact signed blob and wait for validated success. Unbounded
   * external payloads cannot use this method because expiry cannot be determined.
   *
   * @returns A successful validated response with the original transaction type.
   */
  public async submit(): Promise<SuccessfulTxResponse<T>> {
    if (this.toJSON().LastLedgerSequence == null) {
      throw new ValidationError(
        'Waiting requires bounded expiry. Use toBlob for external submission.',
      )
    }
    return this.client.submitAndWait<T>(this.toBlob())
  }

  /**
   * Submit with an explicit success/error outcome, preserving unknown outcomes.
   *
   * @returns A discriminated result including local validation failures.
   */
  public async trySubmit(): Promise<SubmitResult<T>> {
    try {
      return { ok: true, response: await this.submit() }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }

  private validateSigners(
    signers: Signer[],
    payload: Record<string, unknown>,
  ): void {
    if (signers.length > this.signersCount) {
      throw new ValidationError(
        'Signature count exceeds the prepared fee budget.',
      )
    }
    const accounts = new Set<string>()
    for (const { Signer: signer } of signers) {
      if (accounts.has(signer.Account) || signer.Account === payload.Account) {
        throw new ValidationError(
          'Multisigners must be unique and distinct from the transaction account.',
        )
      }
      accounts.add(signer.Account)
      if (
        !verify(
          encodeForMultisigning(payload, signer.Account),
          signer.TxnSignature,
          signer.SigningPubKey,
        )
      ) {
        throw new ValidationError(
          'Invalid multisignature for the prepared payload.',
        )
      }
    }
  }
}
