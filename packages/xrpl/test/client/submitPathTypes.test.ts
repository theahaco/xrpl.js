import { assert } from 'chai'

import type {
  Autofilled,
  MPTokenIssuanceCreate,
  MPTokenIssuanceSet,
  Payment,
  Request,
  SignedBlob,
  SimulateRequest,
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
 * Type-level coverage for the submit path (audit findings 001, 002, 030, 033).
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
    testContext.mockRippled!.addResponse('ledger', rippled.ledger.normal)
    testContext.mockRippled!.addResponse('tx', validatedIssuanceCreate())
  }

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

    it('keeps polling while a lookup is validated but carries no decoded metadata', async function () {
      // `meta` being a hex string or absent is what forced the old union; the sugar now treats
      // such a response as "not final yet" instead of returning something typed as decoded.
      const withoutMeta = validatedIssuanceCreate()
      let txLookups = 0
      testContext.mockRippled!.addResponse('submit', rippled.submit.success)
      testContext.mockRippled!.addResponse('ledger', {
        ...rippled.ledger.normal,
        result: { ...rippled.ledger.normal.result, ledger_index: 12300 },
      })
      testContext.mockRippled!.addResponse('tx', () => {
        txLookups += 1
        if (txLookups < 2) {
          return {
            ...withoutMeta,
            result: {
              ...(withoutMeta.result as Record<string, unknown>),
              meta: 'DEADBEEF',
            },
          }
        }
        return validatedIssuanceCreate()
      })

      const response = await testContext.client.submitAndWait(issuanceCreate, {
        wallet,
        autofill: false,
      })

      assert.strictEqual(txLookups, 2)
      assert.strictEqual(response.result.meta.mpt_issuance_id, MPT_ISSUANCE_ID)
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

  describe('030: simulate threads the transaction type and normalises the request', function () {
    /**
     * Answers `simulate` with a canned response and records the request that was sent.
     *
     * @returns A getter for the `simulate` request the client actually sent.
     */
    function captureSimulate(): () => SimulateRequest {
      let captured: SimulateRequest | undefined
      testContext.mockRippled!.addResponse('simulate', (request: Request) => {
        captured = request as SimulateRequest
        return {
          id: request.id,
          status: 'success',
          type: 'response',
          result: {
            applied: false,
            engine_result: 'tesSUCCESS',
            engine_result_code: 0,
            engine_result_message: 'The simulated transaction would succeed.',
            ledger_index: 12312,
            tx_json: (request as SimulateRequest).tx_json,
            meta: { ...rippled.tx.Payment.result.meta },
          },
        }
      })
      return () => {
        assert.isDefined(captured, 'simulate was never requested')
        return captured
      }
    }

    it('narrows tx_json to the simulated transaction type', async function () {
      const getRequest = captureSimulate()
      const set: MPTokenIssuanceSet = {
        TransactionType: 'MPTokenIssuanceSet',
        Account: wallet.classicAddress,
        MPTokenIssuanceID: MPT_ISSUANCE_ID,
        Flags: { tfMPTLock: true },
      }

      const response = await testContext.client.simulate(set)

      // `T` defaulted to the whole SubmittableTransaction union before.
      const issuanceId: string = response.result.tx_json.MPTokenIssuanceID
      assert.strictEqual(issuanceId, MPT_ISSUANCE_ID)

      // rippled rejects the interface form: `Field 'tx_json.Flags' has bad type.`
      assert.strictEqual(getRequest().tx_json?.Flags, 0x00000001)
      // The caller's object is not mutated.
      assert.deepEqual(set.Flags, { tfMPTLock: true })
    })

    it('folds a Payment DeliverMax into Amount, as autofill does', async function () {
      const getRequest = captureSimulate()
      const payment: Payment = {
        TransactionType: 'Payment',
        Account: wallet.classicAddress,
        Destination: 'rfkE1aSy9G8Upk4JssnwBxhEv5p4mn2KTy',
        Amount: '1234',
        DeliverMax: '1234',
      }
      // @ts-expect-error -- DeliverMax is a non-protocol, RPC level field in Payment transactions
      delete payment.Amount

      await testContext.client.simulate(payment)

      // `DeliverMax` is an RPC-only alias: `Field 'tx_json.DeliverMax' is unknown.`
      const sent = getRequest().tx_json
      assert.strictEqual(sent?.TransactionType, 'Payment')
      assert.strictEqual(sent?.Amount, '1234')
      assert.strictEqual('DeliverMax' in (sent ?? {}), false)
      assert.strictEqual(payment.DeliverMax, '1234')
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
      const flags: number | undefined = filled.Flags

      assert.isNumber(sequence)
      assert.isString(fee)
      assert.isNumber(lastLedgerSequence)
      assert.strictEqual(flags, 0x00000002)
      // The intersection is still assignable to the input type.
      const asInput: MPTokenIssuanceCreate = filled
      assert.strictEqual(asInput.TransactionType, 'MPTokenIssuanceCreate')
    })
  })
})
