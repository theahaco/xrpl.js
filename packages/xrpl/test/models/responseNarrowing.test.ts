import { assert } from 'chai'

import {
  AccountObject,
  AccountObjectsRequest,
  AccountObjectsResponse,
  AccountTxTransaction,
  Client,
  LedgerEntry,
  LedgerEntryRequest,
  MPTokenIssuance,
  MPTokenIssuanceCreate,
  Transaction,
  TransactionMetadata,
  TransactionStream,
  TxRequest,
  TxResponse,
  TxV1Response,
} from '../../src'
import {
  setupClient,
  teardownClient,
  type XrplTestContext,
} from '../setupClient'

/**
 * `true` when `A` and `B` are the same type, `false` otherwise.
 */
type Equals<A, B> =
  (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2
    ? true
    : false

/**
 * Compile-time assertion: only instantiable when `T` is `true`.
 *
 * @returns Always true.
 */
function typeIs<T extends true>(): T {
  return true as T
}

const ISSUER = 'rJSAsZm9mrs7kdAxfswswBimT8DKgwWWwT'
const HOLDER = 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh'
const ISSUANCE_ID = '000000077EEF664B7A629066730123E42508AA854744FFE7'
const TX_HASH =
  'FF8964708994E4868056B4E40B2651D972FE8235F1EBDB3BC8E5B4921887876C'

const issuance: MPTokenIssuance = {
  Flags: 0,
  Issuer: ISSUER,
  LedgerEntryType: 'MPTokenIssuance',
  MaximumAmount: '1000',
  MPTokenMetadata: '7B7D',
  OutstandingAmount: '0',
  OwnerNode: '0',
  PreviousTxnID: TX_HASH,
  PreviousTxnLgrSeq: 21,
  Sequence: 7,
  index: '910ED7E8D1ECC5687209DB58B66CC76E282398BDACA4F5E3C263531E90B775CC',
  mpt_issuance_id: ISSUANCE_ID,
}

const mptoken: LedgerEntry.MPToken = {
  Account: HOLDER,
  Flags: 0,
  LedgerEntryType: 'MPToken',
  MPTokenIssuanceID: ISSUANCE_ID,
  OwnerNode: '0',
  PreviousTxnID: TX_HASH,
  PreviousTxnLgrSeq: 22,
  index: '3E0EF1A38D33CECF97A8510C45CE6027632A00FFCEEC3A33DE4D5DC737332F20',
}

const issuanceCreate: MPTokenIssuanceCreate = {
  TransactionType: 'MPTokenIssuanceCreate',
  Account: ISSUER,
  Fee: '10',
  Sequence: 7,
  SigningPubKey: '',
}

const issuanceCreateMeta = {
  AffectedNodes: [],
  TransactionIndex: 0,
  TransactionResult: 'tesSUCCESS',
  mpt_issuance_id: ISSUANCE_ID,
}

/**
 * Narrow a stream event to an `MPTokenIssuanceCreate` event. TypeScript does
 * not narrow a parent object through a nested discriminant, so this is the
 * idiom that reaches `meta.mpt_issuance_id` on the push path.
 *
 * @param ev - Any transaction stream event.
 * @returns Whether the event carries an MPTokenIssuanceCreate.
 */
function isIssuanceCreateEvent(
  ev: TransactionStream,
): ev is TransactionStream<MPTokenIssuanceCreate> {
  return ev.tx_json?.TransactionType === 'MPTokenIssuanceCreate'
}

describe('Response narrowing by request', function () {
  let testContext: XrplTestContext

  beforeEach(async () => {
    testContext = await setupClient()
  })
  afterEach(async () => teardownClient(testContext))

  describe('ledger_entry', function () {
    beforeEach(() => {
      testContext.mockRippled!.addResponse('ledger_entry', (req) => {
        const node = 'mptoken' in req ? mptoken : issuance
        return {
          id: req.id,
          type: 'response',
          status: 'success',
          result: {
            index: node.index,
            ledger_current_index: 30,
            validated: false,
            node,
          },
        }
      })
    })

    it('narrows node to MPTokenIssuance for an mpt_issuance lookup', async function () {
      const res = await testContext.client.request({
        command: 'ledger_entry',
        mpt_issuance: ISSUANCE_ID,
      })
      // No cast, no LedgerEntryType check.
      assert.equal(res.result.node.MPTokenMetadata, '7B7D')
      assert.equal(res.result.node.mpt_issuance_id, ISSUANCE_ID)
      assert.isTrue(typeIs<Equals<typeof res.result.node, MPTokenIssuance>>())
      // @ts-expect-error -- Balance is an AccountRoot field, not an issuance field
      assert.isUndefined(res.result.node.Balance)
    })

    it('narrows node to MPToken for an mptoken lookup', async function () {
      const res = await testContext.client.request({
        command: 'ledger_entry',
        mptoken: { mpt_issuance_id: ISSUANCE_ID, account: HOLDER },
      })
      assert.equal(res.result.node.MPTokenIssuanceID, ISSUANCE_ID)
      assert.isTrue(
        typeIs<Equals<typeof res.result.node, LedgerEntry.MPToken>>(),
      )
    })

    it('narrows node to AccountRoot for an account_root lookup', async function () {
      const res = await testContext.client.request({
        command: 'ledger_entry',
        account_root: ISSUER,
      })
      assert.exists(res.result.node.index)
      assert.isTrue(
        typeIs<Equals<typeof res.result.node, LedgerEntry.AccountRoot>>(),
      )
    })

    it('keeps the LedgerEntry union for index and mixed lookups', async function () {
      const byIndex = await testContext.client.request({
        command: 'ledger_entry',
        index: issuance.index,
      })
      assert.isTrue(
        typeIs<Equals<typeof byIndex.result.node, LedgerEntry.LedgerEntry>>(),
      )
      assert(byIndex.result.node.LedgerEntryType === 'MPTokenIssuance')
      assert.equal(byIndex.result.node.mpt_issuance_id, ISSUANCE_ID)

      const mixed = await testContext.client.request({
        command: 'ledger_entry',
        mpt_issuance: ISSUANCE_ID,
        offer: 'ABCDEF',
      })
      assert.exists(mixed.result.node)
      assert.isTrue(
        typeIs<Equals<typeof mixed.result.node, LedgerEntry.LedgerEntry>>(),
      )

      const bridge = await testContext.client.request({
        command: 'ledger_entry',
        bridge_account: ISSUER,
        bridge: {
          LockingChainDoor: ISSUER,
          LockingChainIssue: { currency: 'XRP' },
          IssuingChainDoor: HOLDER,
          IssuingChainIssue: { currency: 'XRP' },
        },
      })
      assert.exists(bridge.result.node)
      assert.isTrue(
        typeIs<Equals<typeof bridge.result.node, LedgerEntry.Bridge>>(),
      )
    })

    it('still returns node_binary for binary lookups', async function () {
      testContext.mockRippled!.addResponse('ledger_entry', (req) => ({
        id: req.id,
        type: 'response',
        status: 'success',
        result: {
          index: issuance.index,
          ledger_current_index: 30,
          node_binary: '1100',
        },
      }))
      const res = await testContext.client.request({
        command: 'ledger_entry',
        mpt_issuance: ISSUANCE_ID,
        binary: true,
      })
      assert.equal(res.result.node_binary, '1100')
      assert.isTrue(typeIs<Equals<typeof res.result.node_binary, string>>())
    })
  })

  describe('account_objects', function () {
    beforeEach(() => {
      testContext.mockRippled!.addResponse('account_objects', (req) => {
        if (req.command !== 'account_objects') {
          throw new Error('Expected account_objects request')
        }
        return {
          id: req.id,
          type: 'response',
          status: 'success',
          result: {
            account: req.account,
            account_objects: req.type === 'mptoken' ? [mptoken] : [issuance],
            ledger_current_index: 30,
            validated: false,
          },
        }
      })
    })

    it('narrows account_objects to MPTokenIssuance[] for type mpt_issuance', async function () {
      const res = await testContext.client.request({
        command: 'account_objects',
        account: ISSUER,
        type: 'mpt_issuance',
      })
      assert.equal(res.result.account_objects[0].MaximumAmount, '1000')
      assert.isTrue(
        typeIs<Equals<typeof res.result.account_objects, MPTokenIssuance[]>>(),
      )
    })

    it('narrows account_objects to MPToken[] for type mptoken', async function () {
      const res = await testContext.client.request({
        command: 'account_objects',
        account: HOLDER,
        type: 'mptoken',
      })
      assert.equal(res.result.account_objects[0].MPTokenIssuanceID, ISSUANCE_ID)
      assert.isTrue(
        typeIs<
          Equals<typeof res.result.account_objects, LedgerEntry.MPToken[]>
        >(),
      )
    })

    it('keeps the AccountObject union without a type filter', async function () {
      const res = await testContext.client.request({
        command: 'account_objects',
        account: ISSUER,
      })
      assert.lengthOf(res.result.account_objects, 1)
      assert.isTrue(
        typeIs<Equals<typeof res.result.account_objects, AccountObject[]>>(),
      )
      // The narrowed response is still assignable to the plain response type.
      const plain: AccountObjectsResponse = await testContext.client.request({
        command: 'account_objects',
        account: ISSUER,
        type: 'mpt_issuance',
      })
      assert.lengthOf(plain.result.account_objects, 1)
    })

    it('narrows requestAll pages the same way', async function () {
      const pages = await testContext.client.requestAll({
        command: 'account_objects',
        account: ISSUER,
        type: 'mpt_issuance',
      })
      assert.equal(
        pages[0].result.account_objects[0].mpt_issuance_id,
        ISSUANCE_ID,
      )
      assert.isTrue(
        typeIs<
          Equals<
            (typeof pages)[number]['result']['account_objects'],
            MPTokenIssuance[]
          >
        >(),
      )
    })
  })

  describe('transaction stream and account_tx', function () {
    it('correlates meta with tx_json through TransactionStream<T>', async function () {
      const seen = await new Promise<string | undefined>((resolve) => {
        testContext.client.on('transaction', (ev) => {
          if (isIssuanceCreateEvent(ev)) {
            resolve(ev.meta?.mpt_issuance_id)
          }
        })
        // @ts-expect-error Using private method for testing
        testContext.client.connection.onMessage(
          JSON.stringify({
            type: 'transaction',
            status: 'closed',
            engine_result: 'tesSUCCESS',
            engine_result_code: 0,
            engine_result_message: 'The transaction was applied.',
            ledger_index: 30,
            validated: true,
            tx_json: { ...issuanceCreate, hash: TX_HASH },
            meta: issuanceCreateMeta,
          }),
        )
      })
      assert.equal(seen, ISSUANCE_ID)

      // The default type argument is unchanged, so existing code keeps the
      // full `Transaction` union.
      assert.isTrue(
        typeIs<
          Equals<
            NonNullable<TransactionStream['meta']>,
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-arguments -- asserts the default argument
            TransactionMetadata<Transaction>
          >
        >(),
      )
    })

    it('correlates meta with tx_json through AccountTxTransaction<2, T>', async function () {
      testContext.mockRippled!.addResponse('account_tx', (req) => {
        if (req.command !== 'account_tx') {
          throw new Error('Expected account_tx request')
        }
        return {
          id: req.id,
          type: 'response',
          status: 'success',
          result: {
            account: req.account,
            ledger_index_min: 1,
            ledger_index_max: 30,
            limit: 10,
            transactions: [
              {
                ledger_index: 30,
                hash: TX_HASH,
                validated: true,
                tx_json: issuanceCreate,
                meta: issuanceCreateMeta,
              },
            ],
            validated: true,
          },
        }
      })
      const res = await testContext.client.request({
        command: 'account_tx',
        account: ISSUER,
      })
      const [row] = res.result.transactions
      if (row.tx_json?.TransactionType === 'MPTokenIssuanceCreate') {
        const created = row as AccountTxTransaction<2, MPTokenIssuanceCreate>
        assert(typeof created.meta !== 'string')
        assert.equal(created.meta.mpt_issuance_id, ISSUANCE_ID)
      } else {
        assert.fail('expected an MPTokenIssuanceCreate row')
      }
    })
  })

  describe('api_version inference', function () {
    beforeEach(() => {
      testContext.mockRippled!.addResponse('tx', (req) => ({
        id: req.id,
        type: 'response',
        status: 'success',
        result:
          req.api_version === 1
            ? {
                ...issuanceCreate,
                hash: TX_HASH,
                ledger_index: 30,
                meta: issuanceCreateMeta,
                validated: true,
              }
            : {
                hash: TX_HASH,
                ledger_index: 30,
                tx_json: issuanceCreate,
                meta: issuanceCreateMeta,
                validated: true,
              },
      }))
    })

    it('types a request with api_version 1 as the v1 response', async function () {
      const res = await testContext.client.request({
        command: 'tx',
        transaction: TX_HASH,
        api_version: 1,
      })
      assert.isTrue(typeIs<Equals<typeof res, TxV1Response>>())
      // v1 puts the transaction fields at the top level of `result`.
      assert.equal(res.result.Account, ISSUER)
      assert.isUndefined(res.result.meta_blob)
    })

    it('defaults to the v2 response when api_version is unset', async function () {
      const res = await testContext.client.request({
        command: 'tx',
        transaction: TX_HASH,
      })
      assert.isTrue(typeIs<Equals<typeof res, TxResponse>>())
      assert.equal(res.result.tx_json.Account, ISSUER)
    })

    it('still accepts explicit type arguments', async function () {
      const res = await testContext.client.request<TxRequest, 1>({
        command: 'tx',
        transaction: TX_HASH,
        api_version: 1,
      })
      assert.isTrue(typeIs<Equals<typeof res, TxV1Response>>())
      assert.equal(res.result.Account, ISSUER)
    })
  })

  it('keeps uncertain request options broad while preserving literal inference', function () {
    // Never invoked: negative accesses must remain compiler errors even when
    // strict request-key checking and response inference are combined.
    async function uncertainOptions(
      client: Client,
      requests: {
        ledgerRequest: LedgerEntryRequest
        objectRequest: AccountObjectsRequest
        txRequest: TxRequest
      },
      options: {
        binary: boolean
        version: 1 | 2
        filter: 'offer' | 'mptoken'
        lookup:
          | { command: 'ledger_entry'; mpt_issuance: string }
          | { command: 'ledger_entry'; account_root: string }
      },
    ): Promise<void> {
      const { ledgerRequest, objectRequest, txRequest } = requests
      const { binary, version, filter, lookup } = options
      const broadLedger = await client.request(ledgerRequest)
      // @ts-expect-error -- broad requests may select binary, with no JSON node
      assert.isDefined(broadLedger.result.node.LedgerEntryType)

      const uncertainBinary = await client.request({
        command: 'ledger_entry',
        mpt_issuance: ISSUANCE_ID,
        binary,
      })
      // @ts-expect-error -- boolean binary cannot guarantee a JSON node
      assert.isDefined(uncertainBinary.result.node.MPTokenMetadata)

      const mixedLookup = await client.request(lookup)
      // @ts-expect-error -- the account_root branch has no MPTokenMetadata
      assert.isDefined(mixedLookup.result.node.MPTokenMetadata)

      const broadObjects = await client.request(objectRequest)
      // @ts-expect-error -- an optional filter cannot guarantee Offer entries
      assert.isDefined(broadObjects.result.account_objects[0].TakerGets)

      const mixedObjects = await client.request({
        command: 'account_objects',
        account: ISSUER,
        type: filter,
      })
      // @ts-expect-error -- MPToken entries have no TakerGets
      assert.isDefined(mixedObjects.result.account_objects[0].TakerGets)

      const broadTx = await client.request(txRequest)
      // @ts-expect-error -- optional api_version may select the v1 response
      assert.isDefined(broadTx.result.tx_json)

      const mixedVersion = await client.request({
        command: 'tx',
        transaction: TX_HASH,
        api_version: version,
      })
      // @ts-expect-error -- a version union may select the v1 response
      assert.isDefined(mixedVersion.result.tx_json)

      // Const inference must still accept requests containing mutable arrays.
      await client.request({
        command: 'subscribe',
        accounts: [ISSUER],
        streams: ['transactions'],
      })
    }
    assert.isFunction(uncertainOptions)
  })
})
