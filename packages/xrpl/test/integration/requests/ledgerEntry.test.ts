import { stringToHex } from '@xrplf/isomorphic/utils'
import { assert } from 'chai'

import type {
  CredentialAccept,
  CredentialCreate,
  LedgerEntry,
  LedgerEntryRequest,
} from '../../../src'
import serverUrl from '../serverUrl'
import {
  setupClient,
  teardownClient,
  type XrplIntegrationTestContext,
} from '../setup'
import { generateFundedWallet, testTransaction } from '../utils'

// how long before each test case times out
const TIMEOUT = 20000

describe('ledger_entry', function () {
  let testContext: XrplIntegrationTestContext

  beforeEach(async () => {
    testContext = await setupClient(serverUrl)
  })
  afterEach(async () => teardownClient(testContext))

  it(
    'base',
    async () => {
      const validatedLedgerResponse = await testContext.client.request({
        command: 'ledger_data',
        ledger_index: 'validated',
      })

      assert.equal(validatedLedgerResponse.type, 'response')
      const ledgerEntryIndex = validatedLedgerResponse.result.state[0].index

      const ledgerEntryRequest: LedgerEntryRequest = {
        command: 'ledger_entry',
        index: ledgerEntryIndex,
      }

      const ledgerEntryResponse =
        await testContext.client.request(ledgerEntryRequest)

      const expectedResponse = {
        api_version: 2,
        id: ledgerEntryResponse.id,
        type: 'response',
        result: {
          index: ledgerEntryIndex,
          ledger_current_index: ledgerEntryResponse.result.ledger_current_index,
          node: ledgerEntryResponse.result.node,
          validated: false,
        },
      }

      assert.equal(ledgerEntryResponse.type, 'response')
      assert.deepEqual(ledgerEntryResponse, expectedResponse)
    },
    TIMEOUT,
  )

  it(
    'binary = (default)',
    async () => {
      const wallet = await generateFundedWallet(testContext.client)

      const ledgerEntryResponse = await testContext.client.request({
        command: 'ledger_entry',
        account_root: wallet.address,
      })

      assert.isDefined(ledgerEntryResponse.result.node)
      // @ts-expect-error - node_binary is not present in the response
      assert.isUndefined(ledgerEntryResponse.result.node_binary)
    },
    TIMEOUT,
  )

  it(
    'binary = false',
    async () => {
      const wallet = await generateFundedWallet(testContext.client)

      const ledgerEntryResponse = await testContext.client.request({
        command: 'ledger_entry',
        account_root: wallet.address,
        binary: false,
      })

      assert.isDefined(ledgerEntryResponse.result.node)
      // @ts-expect-error - node_binary is not present in the response
      assert.isUndefined(ledgerEntryResponse.result.node_binary)
    },
    TIMEOUT,
  )

  it(
    'binary = true',
    async () => {
      const wallet = await generateFundedWallet(testContext.client)

      const ledgerEntryResponse = await testContext.client.request({
        command: 'ledger_entry',
        account_root: wallet.address,
        binary: true,
      })

      // @ts-expect-error - node is not present in the response
      assert.isUndefined(ledgerEntryResponse.result.node)
      assert.isDefined(ledgerEntryResponse.result.node_binary)
    },
    TIMEOUT,
  )

  it(
    'validated lookup returns ledger_index and ledger_hash',
    async () => {
      const wallet = await generateFundedWallet(testContext.client)

      const ledgerEntryResponse = await testContext.client.request({
        command: 'ledger_entry',
        account_root: wallet.address,
        ledger_index: 'validated',
      })

      assert.equal(ledgerEntryResponse.type, 'response')
      assert.isTrue(ledgerEntryResponse.result.validated)
      assert.typeOf(ledgerEntryResponse.result.ledger_index, 'number')
      assert.typeOf(ledgerEntryResponse.result.ledger_hash, 'string')
      assert.isUndefined(ledgerEntryResponse.result.ledger_current_index)
      assert.equal(
        ledgerEntryResponse.result.node.LedgerEntryType,
        'AccountRoot',
      )
    },
    TIMEOUT,
  )

  it(
    'credential lookup by subject, issuer and credential_type',
    async () => {
      const issuerWallet = await generateFundedWallet(testContext.client)
      const subjectWallet = await generateFundedWallet(testContext.client)
      const credentialType = stringToHex('kyc')

      const credentialCreateTx: CredentialCreate = {
        TransactionType: 'CredentialCreate',
        Account: issuerWallet.classicAddress,
        Subject: subjectWallet.classicAddress,
        CredentialType: credentialType,
      }
      await testTransaction(
        testContext.client,
        credentialCreateTx,
        issuerWallet,
      )

      const credentialAcceptTx: CredentialAccept = {
        TransactionType: 'CredentialAccept',
        Account: subjectWallet.classicAddress,
        Issuer: issuerWallet.classicAddress,
        CredentialType: credentialType,
      }
      await testTransaction(
        testContext.client,
        credentialAcceptTx,
        subjectWallet,
      )

      const ledgerEntryResponse = await testContext.client.request({
        command: 'ledger_entry',
        credential: {
          subject: subjectWallet.classicAddress,
          issuer: issuerWallet.classicAddress,
          credential_type: credentialType,
        },
        ledger_index: 'validated',
      })

      assert.equal(ledgerEntryResponse.type, 'response')
      const credential = ledgerEntryResponse.result
        .node as LedgerEntry.Credential
      assert.equal(credential.LedgerEntryType, 'Credential')
      assert.equal(credential.Subject, subjectWallet.classicAddress)
      assert.equal(credential.Issuer, issuerWallet.classicAddress)
      assert.equal(credential.CredentialType, credentialType)
      assert.typeOf(ledgerEntryResponse.result.ledger_index, 'number')
    },
    TIMEOUT,
  )
})
