import { assert } from 'chai'

import {
  BATCH_INNER_NOT_APPLIED,
  Batch,
  BatchFlags,
  getBatchInnerHashes,
  Payment,
  Request,
  RippledError,
  ValidationError,
} from '../../src'
import {
  setupClient,
  teardownClient,
  type XrplTestContext,
} from '../setupClient'
import { assertRejects } from '../testUtils'

const OUTER_HASH =
  'A5F9C2B1D4E6F7089A1B2C3D4E5F60718293A4B5C6D7E8F90A1B2C3D4E5F6071'
const account = 'rJCxK2hX9tDMzbnn3cg1GU2g19Kfmhzxkp'
const destination = 'rPMh7Pi9ct699iZUTWaytJUoHcJ7cgyziK'

function innerPayment(sequence: number, amount: string): Payment {
  return {
    TransactionType: 'Payment',
    Account: account,
    Destination: destination,
    Amount: amount,
    Fee: '0',
    Flags: 0x40000000,
    Sequence: sequence,
    SigningPubKey: '',
  }
}

const batch: Batch = {
  TransactionType: 'Batch',
  Account: account,
  Flags: BatchFlags.tfIndependent,
  Sequence: 4,
  Fee: '30',
  LastLedgerSequence: 200,
  SigningPubKey:
    '02BC8C02199949B15C005B997E7C8594574E9B02BA2D0628902E0532989976CF9D',
  TxnSignature:
    '3045022100B3D311371EDAB371CD8F2B661A04B800B61D4B132E09B7B0712D3B2F11B1758302203906B44C4A150311D74FF6A35B146763C0B5B40AC30BD815113F058AA17B3E63',
  RawTransactions: [
    { RawTransaction: innerPayment(5, '1000000') },
    { RawTransaction: innerPayment(6, '2000000') },
    { RawTransaction: innerPayment(7, '3000000') },
  ],
}

const [applied, failed, notApplied] = getBatchInnerHashes(batch)

function txResponse(
  hash: string,
  txJson: Record<string, unknown>,
  meta: Record<string, unknown>,
): Record<string, unknown> {
  return {
    status: 'success',
    type: 'response',
    result: {
      hash,
      ledger_index: 150,
      validated: true,
      tx_json: txJson,
      meta: { AffectedNodes: [], TransactionIndex: 1, ...meta },
    },
  }
}

function byHash(
  handler: (hash: string) => Record<string, unknown>,
): (request: Request) => Record<string, unknown> {
  return (request) =>
    handler('transaction' in request ? String(request.transaction) : '')
}

const notFound = {
  status: 'error',
  type: 'response',
  error: 'txnNotFound',
  error_code: 29,
  error_message: 'Transaction not found.',
}

const ledgerResponses: Record<string, Record<string, unknown>> = {
  [OUTER_HASH]: txResponse(OUTER_HASH, batch, {
    TransactionResult: 'tesSUCCESS',
  }),
  [applied]: txResponse(applied, batch.RawTransactions[0].RawTransaction, {
    TransactionResult: 'tesSUCCESS',
    ParentBatchID: OUTER_HASH,
  }),
  [failed]: txResponse(failed, batch.RawTransactions[1].RawTransaction, {
    TransactionResult: 'tecUNFUNDED_PAYMENT',
    ParentBatchID: OUTER_HASH,
  }),
}

describe('client.getBatchResults', function () {
  let testContext: XrplTestContext

  beforeEach(async () => {
    testContext = await setupClient()
    testContext.mockRippled!.addResponse(
      'tx',
      byHash((hash) => ledgerResponses[hash] ?? notFound),
    )
  })
  afterEach(async () => teardownClient(testContext))

  it('reports each inner transaction by outer hash', async function () {
    const results = await testContext.client.getBatchResults(OUTER_HASH)

    assert.deepEqual(
      results.map(({ hash, result }) => ({ hash, result })),
      [
        { hash: applied, result: 'tesSUCCESS' },
        { hash: failed, result: 'tecUNFUNDED_PAYMENT' },
        { hash: notApplied, result: BATCH_INNER_NOT_APPLIED },
      ],
    )
    assert.equal(results[0].tx?.result.meta_blob, undefined)
    assert.equal(
      (results[0].tx?.result.meta as { ParentBatchID: string }).ParentBatchID,
      OUTER_HASH,
    )
    assert.deepEqual(
      results[0].tx?.result.tx_json,
      batch.RawTransactions[0].RawTransaction,
    )
    assert.isUndefined(results[2].tx)
  })

  it('accepts the submitted Batch without fetching the outer transaction', async function () {
    testContext.mockRippled!.addResponse(
      'tx',
      byHash((hash) => {
        if (hash === OUTER_HASH) {
          throw new Error('outer transaction must not be fetched')
        }
        return ledgerResponses[hash] ?? notFound
      }),
    )

    const results = await testContext.client.getBatchResults(batch)

    assert.deepEqual(
      results.map(({ result }) => result),
      ['tesSUCCESS', 'tecUNFUNDED_PAYMENT', BATCH_INNER_NOT_APPLIED],
    )
  })

  it('reports every inner transaction as not-applied after a tfAllOrNothing revert', async function () {
    testContext.mockRippled!.addResponse(
      'tx',
      byHash((hash) => {
        return hash === OUTER_HASH ? ledgerResponses[OUTER_HASH] : notFound
      }),
    )

    const results = await testContext.client.getBatchResults(OUTER_HASH)

    assert.deepEqual(results, [
      { hash: applied, result: BATCH_INNER_NOT_APPLIED },
      { hash: failed, result: BATCH_INNER_NOT_APPLIED },
      { hash: notApplied, result: BATCH_INNER_NOT_APPLIED },
    ])
  })

  it('rejects a hash that is not a Batch', async function () {
    testContext.mockRippled!.addResponse('tx', () =>
      txResponse(applied, batch.RawTransactions[0].RawTransaction, {
        TransactionResult: 'tesSUCCESS',
      }),
    )

    await assertRejects(
      testContext.client.getBatchResults(applied),
      ValidationError,
      `getBatchResults: transaction ${applied} is a Payment, not a Batch.`,
    )
  })

  it('rejects when the outer Batch is not found', async function () {
    testContext.mockRippled!.addResponse('tx', () => notFound)

    await assertRejects(
      testContext.client.getBatchResults(OUTER_HASH),
      RippledError,
      'Transaction not found.',
    )
  })

  it('propagates inner lookup errors other than txnNotFound', async function () {
    testContext.mockRippled!.addResponse(
      'tx',
      byHash((hash) => {
        return hash === OUTER_HASH
          ? ledgerResponses[OUTER_HASH]
          : {
              status: 'error',
              type: 'response',
              error: 'lgrNotFound',
              error_message: 'ledgerNotFound',
            }
      }),
    )

    await assertRejects(
      testContext.client.getBatchResults(OUTER_HASH),
      RippledError,
      'ledgerNotFound',
    )
  })

  it('rejects an inner transaction that has no metadata yet', async function () {
    testContext.mockRippled!.addResponse(
      'tx',
      byHash((hash) => {
        if (hash === OUTER_HASH) {
          return ledgerResponses[OUTER_HASH]
        }
        return {
          status: 'success',
          type: 'response',
          result: {
            hash,
            validated: false,
            tx_json: batch.RawTransactions[0].RawTransaction,
          },
        }
      }),
    )

    await assertRejects(
      testContext.client.getBatchResults(OUTER_HASH),
      ValidationError,
      /^getBatchResults: inner transaction [0-9A-F]{64} has no metadata; it may not be validated yet\.$/u,
    )
  })
})
