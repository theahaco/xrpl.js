import { Client, Wallet } from '../../src'

const wallet = Wallet.generate()
const other = Wallet.generate()

describe('account scopes', () => {
  const client = new Client('ws://localhost:6006', { feeCushion: 1.7 })
  afterEach(() => jest.restoreAllMocks())

  it('builds without a private key, a connection or signing methods', () => {
    const draft = client
      .forAccount(wallet.address)
      .tx.payment({ Amount: '1', Destination: other.address })
    expect(draft.toJSON()).toEqual({
      TransactionType: 'Payment',
      Account: wallet.address,
      Amount: '1',
      Destination: other.address,
    })
    expect(draft).not.toHaveProperty('signAndSubmit')
    expect(client.isConnected()).toBe(false)
  })

  it('uses the existing client when preparing for an external signer', async () => {
    const autofill = jest.spyOn(client, 'autofill').mockResolvedValue({
      TransactionType: 'Payment',
      Account: wallet.address,
      Amount: '1',
      Destination: other.address,
      Fee: '17',
      Sequence: 1,
      LastLedgerSequence: 100,
    })
    const draft = client
      .forAccount(wallet.address)
      .tx.payment({ Amount: '1', Destination: other.address })
    const prepared = await draft.prepare()
    expect(prepared.Fee).toBe('17')
    expect(autofill).toHaveBeenCalledWith(draft.toJSON())
    prepared.Amount = '999'
    expect(draft.toJSON().Amount).toBe('1')
  })

  it('reuses a connection while keeping regular-key signer and account distinct', async () => {
    const submit = jest
      .spyOn(client, 'submitAndWait')
      .mockResolvedValue({ result: {} } as never)
    await client
      .forAccount(other.address)
      .withWallet(wallet)
      .tx.payment({ Amount: '1', Destination: wallet.address })
      .signAndSubmit()
    expect(submit).toHaveBeenCalledWith(
      {
        TransactionType: 'Payment',
        Account: other.address,
        Amount: '1',
        Destination: wallet.address,
      },
      { wallet },
    )
    expect(client.wallet).toBeUndefined()
    expect(client.withWallet(wallet).tx.accountSet({}).toJSON().Account).toBe(
      wallet.address,
    )
  })

  it('rejects malformed account addresses when creating a scope', () => {
    expect(() => client.forAccount('rNotAnAddress')).toThrow(
      'classic account address',
    )
  })
})

// Compile-time consumer contracts; this function is deliberately never invoked.
function accountScopeTypes(): void {
  const client = new Client('ws://localhost:6006')
  const account = client.forAccount(wallet.address)
  const draft = account.tx.payment({ Amount: '1', Destination: other.address })
  // @ts-expect-error -- the external account has no local signing wallet
  draft.signAndSubmit()
  // @ts-expect-error -- payment fields remain strict through the account scope
  account.tx.payment({ Amount: '1', Destinatoin: other.address })
  const repeated = {
    TransactionType: 'Payment',
    Amount: '1',
    Destination: other.address,
  }
  // @ts-expect-error -- factories own the discriminator
  account.tx.payment(repeated)
}
void accountScopeTypes
