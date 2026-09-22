import { assert } from 'chai'

import type {
  Autofilled,
  Client,
  MPTokenIssuanceCreate,
  Payment,
  SignedBlob,
  SubmittableTransaction,
} from '../../src'
import { MPTokenIssuanceCreateFlags, Wallet } from '../../src'
// Not re-exported from the package root; see the follow-ups in the pull request description.
import type { MPTokenIssuanceCreateMetadata } from '../../src/models/transactions/MPTokenIssuanceCreate'
import rippled from '../fixtures/rippled'
import {
  setupClient,
  teardownClient,
  type XrplTestContext,
} from '../setupClient'

/**
 * Type-level coverage for the submit path (audit findings 001, 002, 033).
 *
 * The assignments below are the assertions: each one only compiles once the corresponding
 * signature carries the transaction type through. They are paired with runtime assertions so a
 * regression that keeps the types but breaks the values still fails.
 */
describe('submit path typing', function () {
  let testContext: XrplTestContext

  beforeEach(async () => {
    testContext = await setupClient()
  })
  afterEach(async () => teardownClient(testContext))

  const wallet = Wallet.fromSeed('spkcsko6Ag3RbCSVXV2FJ8Pd4Zac1')

  const issuanceCreate: MPTokenIssuanceCreate = {
    TransactionType: 'MPTokenIssuanceCreate',
    Account: wallet.classicAddress,
    AssetScale: 2,
    Fee: '12',
    Sequence: 1,
    LastLedgerSequence: 12312,
    // Numeric so the transaction can be signed as-is, without a round trip through autofill.
    Flags: MPTokenIssuanceCreateFlags.tfMPTCanLock,
  }

  const MPT_ISSUANCE_ID = '00000BB8194E6CFB8BDB5C2F1E5B3A73E0E9A4C4E0A0A5F1'

  /**
   * Builds a validated `tx` response for the MPTokenIssuanceCreate above.
   *
   * @returns A mock rippled `tx` response carrying decoded MPTokenIssuanceCreate metadata.
   */
  function validatedIssuanceCreate(): Record<string, unknown> {
    return {
      ...rippled.tx.Payment,
      result: {
        ...rippled.tx.Payment.result,
        validated: true,
        tx_json: issuanceCreate,
        meta: {
          ...rippled.tx.Payment.result.meta,
          TransactionResult: 'tesSUCCESS',
          mpt_issuance_id: MPT_ISSUANCE_ID,
        },
      },
    }
  }

  function mockValidatedSubmission(): void {
    testContext.mockRippled!.addResponse('submit', rippled.submit.success)
    testContext.mockRippled!.addResponse('ledger', {
      ...rippled.ledger.normal,
      result: { ...rippled.ledger.normal.result, ledger_index: 12300 },
    })
    testContext.mockRippled!.addResponse('tx', validatedIssuanceCreate())
  }

  it('rejects misspelled direct drafts while accepting modeled drafts and blobs', function () {
    // Never invoked: rejected code must remain a compile error, and valid
    // stored/union transaction types must remain usable without assertions.
    async function checkSubmissionInputs(
      client: Client,
      inputs: {
        broad: SubmittableTransaction
        union: Payment | MPTokenIssuanceCreate
        blob: SignedBlob<MPTokenIssuanceCreate>
        rawBlob: string
      },
    ): Promise<void> {
      const { broad, union, blob, rawBlob } = inputs
      await client.submitAndWait(
        // @ts-expect-error -- typo rejected at the generic submission boundary
        {
          TransactionType: 'Payment',
          Account: wallet.address,
          Destination: 'rExample',
          Amount: '1',
          DestinationTagg: 12,
        },
        { wallet },
      )
      const draft = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: 'rExample',
        Amount: '1',
        DestinationTag: 12,
      } satisfies Payment
      await client.submitAndWait(draft, { wallet })
      await client.submitAndWait(broad, { wallet })
      await client.submitAndWait(union, { wallet })
      const typed = await client.submitAndWait(blob)
      const issuanceID: string | undefined = typed.result.meta.mpt_issuance_id
      assert.isUndefined(issuanceID)
      await client.submitAndWait(rawBlob)
    }
    assert.isFunction(checkSubmissionInputs)
  })

  describe('001: submitAndWait resolves with decoded, validated metadata', function () {
    it('types meta as the transaction-specific metadata, with no guard or cast', async function () {
      mockValidatedSubmission()

      const response = await testContext.client.submitAndWait(issuanceCreate, {
        wallet,
        autofill: false,
      })

      // Neither `string` nor `undefined` occurs on this path, so no narrowing is needed.
      const meta: MPTokenIssuanceCreateMetadata = response.result.meta
      const validated: true = response.result.validated
      const txJson: MPTokenIssuanceCreate = response.result.tx_json

      assert.strictEqual(meta.TransactionResult, 'tesSUCCESS')
      assert.strictEqual(meta.mpt_issuance_id, MPT_ISSUANCE_ID)
      assert.strictEqual(validated, true)
      assert.strictEqual(txJson.TransactionType, 'MPTokenIssuanceCreate')
    })
  })

  describe('002: a signed blob remembers its transaction type', function () {
    it('infers T from wallet.sign(...).tx_blob without an explicit type argument', async function () {
      mockValidatedSubmission()

      const { tx_blob: txBlob } = wallet.sign(issuanceCreate)

      // The brand is a phantom property: a SignedBlob is still just a string at runtime.
      const asString: string = txBlob
      const asBlob: SignedBlob<MPTokenIssuanceCreate> = txBlob
      assert.isString(asString)
      assert.strictEqual(asBlob, asString)

      const response = await testContext.client.submitAndWait(txBlob)
      const meta: MPTokenIssuanceCreateMetadata = response.result.meta

      assert.strictEqual(meta.mpt_issuance_id, MPT_ISSUANCE_ID)
    })
  })

  describe('033: autofill reports the fields it filled as present', function () {
    it('makes Sequence, Fee and LastLedgerSequence non-optional and Flags a number', async function () {
      testContext.mockRippled!.addResponse(
        'account_info',
        rippled.account_info.normal,
      )
      testContext.mockRippled!.addResponse(
        'server_info',
        rippled.server_info.normal,
      )
      testContext.mockRippled!.addResponse('ledger', rippled.ledger.normal)

      const filled: Autofilled<MPTokenIssuanceCreate> =
        await testContext.client.autofill({
          TransactionType: 'MPTokenIssuanceCreate',
          Account: 'rGWrZyQqhTp9Xu7G5Pkayo7bXjH4k4QYpf',
          AssetScale: 2,
          Flags: { tfMPTCanLock: true },
        })

      const sequence: number = filled.Sequence
      const fee: string = filled.Fee
      const lastLedgerSequence: number = filled.LastLedgerSequence
      const flags: number = filled.Flags

      assert.isNumber(sequence)
      assert.isString(fee)
      assert.isNumber(lastLedgerSequence)
      assert.strictEqual(flags, 0x00000002)
      // The normalized transaction is still assignable to the wire model.
      const asInput: MPTokenIssuanceCreate = filled
      assert.strictEqual(asInput.TransactionType, 'MPTokenIssuanceCreate')
    })

    it('replaces an inferred object Flags field with a number', async function () {
      const draft = {
        TransactionType: 'MPTokenIssuanceCreate',
        Account: wallet.address,
        Fee: '12',
        Sequence: 1,
        LastLedgerSequence: 12312,
        Flags: { tfMPTCanLock: true },
      } satisfies MPTokenIssuanceCreate
      const prepared = await testContext.client.autofill(draft)
      const flags: number = prepared.Flags
      assert.strictEqual(flags, MPTokenIssuanceCreateFlags.tfMPTCanLock)
      // @ts-expect-error -- the input's object flag shape no longer exists
      assert.isUndefined(prepared.Flags.tfMPTCanLock)
      assert.deepEqual(draft.Flags, { tfMPTCanLock: true })
    })
  })
})
