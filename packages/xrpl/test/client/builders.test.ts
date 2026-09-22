import { assert } from 'chai'

import { Client, Wallet, WalletClient } from '../../src'
import { commandNames, transactionNames } from '../../src/client/registries'

describe('wallet-bound client builders', function () {
  const wallet = Wallet.generate()
  const recipient = Wallet.generate()
  const client = new WalletClient('ws://localhost:6006', { wallet })

  it('fills the signer account and selected transaction type without sending', function () {
    const draft = client.tx.payment({
      Amount: '1',
      Destination: recipient.address,
    })
    assert.deepEqual(draft.toJSON(), {
      TransactionType: 'Payment',
      Account: wallet.address,
      Amount: '1',
      Destination: recipient.address,
    })
    assert.isFalse(client.isConnected())
  })

  it('snapshots nested fields so later edits cannot change the transaction', function () {
    const fields = {
      Amount: '1',
      Destination: recipient.address,
      Memos: [{ Memo: { MemoData: 'AB' } }],
    }
    const draft = client.tx.payment(fields)
    fields.Memos[0].Memo.MemoData = 'CD'
    const copy = draft.toJSON()
    copy.Memos![0].Memo.MemoData = 'EF'
    assert.strictEqual(draft.toJSON().Memos![0].Memo.MemoData, 'AB')
  })

  it('allows an explicit account for regular-key signing', function () {
    assert.strictEqual(
      client.tx
        .payment({
          Account: recipient.address,
          Amount: '1',
          Destination: wallet.address,
        })
        .toJSON().Account,
      recipient.address,
    )
  })

  it('exposes every registered transaction and excludes validator pseudo-transactions', function () {
    assert.sameMembers(Object.keys(client.tx), Object.values(transactionNames))
    assert.isFalse('enableAmendment' in client.tx)
    assert.isFalse('setFee' in client.tx)
    for (const [wireName, builderName] of Object.entries(transactionNames)) {
      // Deliberately incomplete drafts verify only registry dispatch, never signing or submission.
      const create: (fields: never) => {
        toJSON: () => { TransactionType: string; Account: string }
      } = client.tx[builderName]
      const draft = create({} as never)
      assert.strictEqual(draft.toJSON().TransactionType, wireName)
      assert.strictEqual(draft.toJSON().Account, wallet.address)
    }
  })

  it('provides discoverable commands on clients without a signing wallet', async function () {
    const reader = new Client('ws://localhost:6006')
    assert.sameMembers(Object.keys(reader.command), Object.values(commandNames))
    const request = jest
      .spyOn(reader, 'request')
      .mockResolvedValue({ id: 1, type: 'response', result: {} })
    await reader.command.accountInfo({
      account: wallet.address,
      ledger_index: 'validated',
    })
    expect(request.mock.calls[0][0]).toEqual({
      command: 'account_info',
      account: wallet.address,
      ledger_index: 'validated',
    })
    await reader.command.ping()
    assert.deepEqual(request.mock.calls[1][0], { command: 'ping' })
  })
})
