import { assert } from 'chai'

import {
  MAX_TRANSFER_FEE,
  RippledError,
  fetchMPToken,
  fetchMPTokenIssuance,
  fetchMPTokenIssuanceOrUndefined,
  fetchMPTokenOrUndefined,
} from '../../src'
import type { MPTLedgerReader } from '../../src'

const MPT_ISSUANCE_ID = '00000003D1478D4517822D2618230F4D55C1F40656D40D60'
const ISSUER = 'rLnZAb1b9e1w9BfmuPUqyWjhWtWTbMEVUu'
const HOLDER = 'rD72zF1wfr5irhyaMF9kyET7bxRgsvpLB'

const ISSUANCE_NODE = {
  LedgerEntryType: 'MPTokenIssuance',
  AssetScale: 2,
  Issuer: ISSUER,
  MaximumAmount: '1000000',
  OutstandingAmount: '500',
  Sequence: 3,
  TransferFee: 1000,
}

const MPTOKEN_NODE = {
  LedgerEntryType: 'MPToken',
  Account: HOLDER,
  MPTokenIssuanceID: MPT_ISSUANCE_ID,
  MPTAmount: '500',
}

interface StubRequest {
  command: string
  mpt_issuance?: string
  mptoken?: { account: string; mpt_issuance_id: string }
  ledger_index?: unknown
}

/**
 * A minimal `request`-only reader: the structural type the fetch helpers take,
 * standing in for a connected Client.
 *
 * @param handler - Serves the `ledger_entry` request.
 * @returns A reader whose `request` calls the handler.
 */
function reader(
  handler: (request: StubRequest) => unknown,
): MPTLedgerReader & { calls: StubRequest[] } {
  const calls: StubRequest[] = []
  const request = async (req: StubRequest): Promise<unknown> => {
    calls.push(req)
    return handler(req)
  }

  return { request, calls } as unknown as MPTLedgerReader & {
    calls: StubRequest[]
  }
}

/**
 * A reader that always fails the way rippled does for a missing entry.
 *
 * @returns A reader whose `request` rejects with `entryNotFound`.
 */
function missingEntryReader(): MPTLedgerReader {
  return reader(() => {
    throw new RippledError('entryNotFound', { error: 'entryNotFound' })
  })
}

describe('fetchMPTokenIssuance', function () {
  it('returns the typed issuance node', async function () {
    const client = reader(() => ({ result: { node: ISSUANCE_NODE } }))

    const issuance = await fetchMPTokenIssuance(client, MPT_ISSUANCE_ID)

    assert.equal(issuance.AssetScale, 2)
    assert.equal(issuance.OutstandingAmount, '500')
    assert.isAtMost(issuance.TransferFee ?? 0, MAX_TRANSFER_FEE)
    assert.deepEqual(client.calls[0], {
      command: 'ledger_entry',
      mpt_issuance: MPT_ISSUANCE_ID,
      ledger_index: undefined,
    })
  })

  it('passes an explicit ledger index through', async function () {
    const client = reader(() => ({ result: { node: ISSUANCE_NODE } }))

    await fetchMPTokenIssuance(client, MPT_ISSUANCE_ID, 42)

    assert.equal(client.calls[0].ledger_index, 42)
  })

  it('throws when the issuance does not exist', async function () {
    let error: unknown
    try {
      await fetchMPTokenIssuance(missingEntryReader(), MPT_ISSUANCE_ID)
    } catch (err) {
      error = err
    }

    assert.instanceOf(error, RippledError)
  })
})

describe('fetchMPToken', function () {
  it('returns the typed MPToken node', async function () {
    const client = reader(() => ({ result: { node: MPTOKEN_NODE } }))

    const mptoken = await fetchMPToken(client, HOLDER, MPT_ISSUANCE_ID)

    assert.equal(mptoken.MPTAmount, '500')
    assert.deepEqual(client.calls[0], {
      command: 'ledger_entry',
      mptoken: { mpt_issuance_id: MPT_ISSUANCE_ID, account: HOLDER },
      ledger_index: undefined,
    })
  })
})

describe('the orUndefined variants', function () {
  it('fetchMPTokenOrUndefined returns undefined for a missing MPToken', async function () {
    assert.isUndefined(
      await fetchMPTokenOrUndefined(
        missingEntryReader(),
        HOLDER,
        MPT_ISSUANCE_ID,
      ),
    )
  })

  it('fetchMPTokenIssuanceOrUndefined returns undefined for a missing issuance', async function () {
    assert.isUndefined(
      await fetchMPTokenIssuanceOrUndefined(
        missingEntryReader(),
        MPT_ISSUANCE_ID,
      ),
    )
  })

  it('returns the entry when it exists', async function () {
    const client = reader(() => ({ result: { node: MPTOKEN_NODE } }))

    const mptoken = await fetchMPTokenOrUndefined(
      client,
      HOLDER,
      MPT_ISSUANCE_ID,
    )

    assert.equal(mptoken?.MPTAmount, '500')
  })

  it('rethrows an error that is not entryNotFound', async function () {
    const client = reader(() => {
      throw new RippledError('malformedRequest', { error: 'malformedRequest' })
    })

    let error: unknown
    try {
      await fetchMPTokenIssuanceOrUndefined(client, MPT_ISSUANCE_ID)
    } catch (err) {
      error = err
    }

    assert.instanceOf(error, RippledError)
  })
})
