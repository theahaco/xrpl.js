/* eslint-disable @typescript-eslint/restrict-template-expressions -- error type thrown can be any */
import { assert } from 'chai'
import cloneDeep from 'lodash/cloneDeep'

import { multisign, ValidationError } from '../../src'
import { Batch, Transaction } from '../../src/models/transactions'
import { BatchFlags } from '../../src/models/transactions/batch'
import { Wallet } from '../../src/Wallet'
import { signMultiBatch } from '../../src/Wallet/batchSigner'
import rippled from '../fixtures/rippled'
import {
  setupClient,
  teardownClient,
  type XrplTestContext,
} from '../setupClient'
import { assertRejects } from '../testUtils'

describe('client.submit', function () {
  let testContext: XrplTestContext

  beforeEach(async () => {
    testContext = await setupClient()
  })
  afterEach(async () => teardownClient(testContext))

  describe('submit unsigned transactions', function () {
    const publicKey =
      '030E58CDD076E798C84755590AAF6237CA8FAE821070A59F648B517A30DC6F589D'
    const privateKey =
      '00141BA006D3363D2FB2785E8DF4E44D3A49908780CB4FB51F6D217C08C021429F'
    const address = 'rhvh5SrgBL5V8oeV9EpDuVszeJSSCEkbPc'
    const transaction: Transaction = {
      TransactionType: 'Payment',
      Account: address,
      Destination: 'rQ3PTWGLCbPz8ZCicV5tCX3xuymojTng5r',
      Amount: '20000000',
      Sequence: 1,
      Fee: '12',
      LastLedgerSequence: 12312,
    }

    it('should submit an unsigned transaction', async function () {
      const tx = cloneDeep(transaction)

      const wallet = new Wallet(publicKey, privateKey)

      testContext.mockRippled!.addResponse(
        'account_info',
        rippled.account_info.normal,
      )
      testContext.mockRippled!.addResponse('ledger', rippled.ledger.normal)
      testContext.mockRippled!.addResponse(
        'server_info',
        rippled.server_info.normal,
      )
      testContext.mockRippled!.addResponse('submit', rippled.submit.success)

      try {
        const response = await testContext.client.submit(tx, { wallet })
        assert(response.result.engine_result, 'tesSUCCESS')
      } catch (error) {
        assert(false, `Did not expect an error to be thrown: ${error}`)
      }
    })

    it('should submit a Batch containing an AccountDelete with fail_hard', async function () {
      const wallet = new Wallet(publicKey, privateKey)
      const batch: Batch = {
        TransactionType: 'Batch',
        Account: address,
        RawTransactions: [
          {
            RawTransaction: {
              TransactionType: 'AccountDelete',
              Flags: 0x40000000,
              Account: address,
              Destination: 'rQ3PTWGLCbPz8ZCicV5tCX3xuymojTng5r',
            },
          },
        ],
        Sequence: 1,
        Fee: '12',
        LastLedgerSequence: 12312,
      }

      testContext.mockRippled!.addResponse(
        'account_info',
        rippled.account_info.normal,
      )
      testContext.mockRippled!.addResponse(
        'account_objects',
        rippled.account_objects.empty,
      )
      let failHard: unknown
      testContext.mockRippled!.addResponse('submit', (request) => {
        failHard = request.fail_hard
        return rippled.submit.success
      })

      await testContext.client.submit(batch, { wallet })
      assert.strictEqual(failHard, true)
    })

    it('should throw a ValidationError when autofill would invalidate BatchSigners', async function () {
      const wallet = new Wallet(publicKey, privateKey)
      const cosigner = Wallet.generate()
      const batch: Batch = {
        TransactionType: 'Batch',
        Account: address,
        Flags: BatchFlags.tfAllOrNothing,
        RawTransactions: [
          {
            RawTransaction: {
              TransactionType: 'Payment',
              Flags: 0x40000000,
              Account: cosigner.classicAddress,
              Destination: address,
              Amount: '1000',
              Fee: '0',
              Sequence: 5,
              SigningPubKey: '',
            },
          },
        ],
        Sequence: 1,
        Fee: '12',
        LastLedgerSequence: 12312,
      }
      // Co-sign at Sequence 1, then submit without it so that autofill binds
      // the account's real sequence (23) and invalidates the co-signature.
      signMultiBatch(cosigner, batch)
      const staleBatch = cloneDeep(batch)
      delete staleBatch.Sequence

      testContext.mockRippled!.addResponse(
        'account_info',
        rippled.account_info.normal,
      )
      testContext.mockRippled!.addResponse('ledger', rippled.ledger.normal)
      testContext.mockRippled!.addResponse(
        'server_info',
        rippled.server_info.normal,
      )
      testContext.mockRippled!.addResponse('submit', rippled.submit.success)

      await assertRejects(
        testContext.client.submit(staleBatch, { wallet }),
        ValidationError,
        'Autofill changed a field the BatchSigners signed over (outer Sequence/TicketSequence or an inner transaction), so the co-signatures would no longer verify. Autofill the Batch before co-signing it with signMultiBatch and submit it with autofill: false.',
      )

      // With the Batch left as it was co-signed, submitting works.
      const response = await testContext.client.submit(batch, {
        wallet,
        autofill: false,
      })
      assert.strictEqual(response.result.engine_result, 'tesSUCCESS')
    })

    it('should throw a ValidationError when submitting an unsigned transaction without a wallet', async function () {
      const tx: Transaction = cloneDeep(transaction)
      delete tx.SigningPubKey
      delete tx.TxnSignature

      testContext.mockRippled!.addResponse('submit', rippled.submit.success)

      await assertRejects(
        testContext.client.submit(tx),
        ValidationError,
        'Wallet must be provided when submitting an unsigned transaction',
      )
    })
  })

  describe('submit signed transactions', function () {
    const signedTransaction: Transaction = {
      TransactionType: 'Payment',
      Sequence: 1,
      LastLedgerSequence: 12312,
      Amount: '20000000',
      Fee: '12',
      SigningPubKey:
        '030E58CDD076E798C84755590AAF6237CA8FAE821070A59F648B517A30DC6F589D',
      TxnSignature:
        '3045022100B3D311371EDAB371CD8F2B661A04B800B61D4B132E09B7B0712D3B2F11B1758302203906B44C4A150311D74FF6A35B146763C0B5B40AC30BD815113F058AA17B3E63',
      Account: 'rhvh5SrgBL5V8oeV9EpDuVszeJSSCEkbPc',
      Destination: 'rQ3PTWGLCbPz8ZCicV5tCX3xuymojTng5r',
    }

    it('should submit a signed transaction', async function () {
      const signedTx = { ...signedTransaction }

      testContext.mockRippled!.addResponse('submit', rippled.submit.success)

      try {
        const response = await testContext.client.submit(signedTx)
        assert(response.result.engine_result, 'tesSUCCESS')
      } catch (_error) {
        assert(false, 'Did not expect an error to be thrown')
      }
    })

    it("should submit a signed transaction that's already encoded", async function () {
      const signedTxEncoded =
        '1200002400000001201B00003018614000000001312D0068400000000000000C7321030E58CDD076E798C84755590AAF6237CA8FAE821070A59F648B517A30DC6F589D74473045022100B3D311371EDAB371CD8F2B661A04B800B61D4B132E09B7B0712D3B2F11B1758302203906B44C4A150311D74FF6A35B146763C0B5B40AC30BD815113F058AA17B3E6381142AF1861DEC1316AEEC995C94FF9E2165B1B784608314FDB08D07AAA0EB711793A3027304D688E10C3648'

      testContext.mockRippled!.addResponse('submit', rippled.submit.success)

      try {
        const response = await testContext.client.submit(signedTxEncoded)
        assert(response.result.engine_result, 'tesSUCCESS')
      } catch (error) {
        assert(false, `Did not expect an error to be thrown: ${error}`)
      }
    })

    it('should submit a multisigned transaction', async function () {
      const signerWallet1 = Wallet.generate()
      const signerWallet2 = Wallet.generate()
      const accountSetTx: Transaction = {
        TransactionType: 'AccountSet',
        Account: 'rhvh5SrgBL5V8oeV9EpDuVszeJSSCEkbPc',
        Sequence: 1,
        Fee: '12',
        LastLedgerSequence: 12312,
      }

      testContext.mockRippled!.addResponse('submit', rippled.submit.success)

      const signed1 = signerWallet1.sign(accountSetTx, true)
      const signed2 = signerWallet2.sign(accountSetTx, true)
      const multisignedTxEncoded = multisign([signed1.tx_blob, signed2.tx_blob])

      try {
        const response = await testContext.client.submit(multisignedTxEncoded)
        assert(response.result.engine_result, 'tesSUCCESS')
      } catch (error) {
        assert(false, `Did not expect an error to be thrown: ${error}`)
      }
    })
  })
})
