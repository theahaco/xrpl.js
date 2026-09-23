/* eslint-disable @typescript-eslint/unbound-method -- Jest inspects spies without invoking unbound methods. */
import { decode, encode } from 'ripple-binary-codec'

import { Client, Wallet } from '../../src'

const issuer = Wallet.generate()
const signer = Wallet.generate()
const second = Wallet.generate()
const destination = Wallet.generate()
const client = new Client('ws://localhost:6006')
const draft = (): ReturnType<
  ReturnType<Client['forAccount']>['tx']['payment']
> =>
  client
    .forAccount(issuer.address)
    .tx.payment({ Amount: '1', Destination: destination.address })

describe('immutable multisig lifecycle', () => {
  beforeEach(() => {
    jest.spyOn(client, 'autofill').mockImplementation(
      async (tx) =>
        ({
          ...tx,
          Fee: '36',
          Sequence: 1,
          LastLedgerSequence: 100,
          Flags: 0,
        }) as never,
    )
  })
  afterEach(() => jest.restoreAllMocks())

  it('prepares once with a signature-count fee and bounded expiry', async () => {
    const prepared = await draft().prepareMultisig({ signersCount: 2 })
    expect(client.autofill).toHaveBeenCalledWith(draft().toJSON(), 2)
    expect(prepared.toJSON()).toMatchObject({
      Fee: '36',
      LastLedgerSequence: 100,
      SigningPubKey: '',
    })
    expect(() => prepared.toBlob()).toThrow('at least one signature')
    const signed = prepared.sign(signer).sign(second)
    expect(signed.toJSON().Signers).toHaveLength(2)
    expect(prepared.toJSON().Signers).toBeUndefined()
    signed.toJSON().Signers?.pop()
    expect(signed.toJSON().Signers).toHaveLength(2)
    const submit = jest
      .spyOn(client, 'submitAndWait')
      .mockResolvedValue({ result: {} } as never)
    await signed.submit()
    expect(submit).toHaveBeenCalledWith(signed.toBlob())
    expect(client.autofill).toHaveBeenCalledTimes(1)
  })

  it('accepts external signatures, including an explicit regular-key signer account', async () => {
    const prepared = await draft().prepareMultisig({ signersCount: 2 })
    const regularKeyAccount = Wallet.generate().address
    const external = signer.sign(prepared.toJSON(), regularKeyAccount).tx_blob
    const combined = prepared.addSignature(external).sign(second)
    expect(
      combined.toJSON().Signers?.map(({ Signer }) => Signer.Account),
    ).toContain(regularKeyAccount)
  })

  it('rejects altered payloads, invalid signatures, duplicates and excess signers', async () => {
    const prepared = await draft().prepareMultisig({ signersCount: 2 })
    const signed = prepared.sign(signer)
    const otherPayload = { ...prepared.toJSON(), Amount: '2' }
    expect(() =>
      prepared.addSignature(signer.sign(otherPayload, true).tx_blob),
    ).toThrow('payload differs')
    const invalid = decode(signed.toBlob()) as unknown as ReturnType<
      typeof signed.toJSON
    >
    invalid.Signers![0].Signer.TxnSignature = '00'.repeat(64)
    expect(() => prepared.addSignature(encode(invalid))).toThrow()
    expect(() => signed.sign(signer)).toThrow('unique')
    expect(() => signed.sign(second).sign(destination)).toThrow('fee budget')
    expect(() => prepared.sign(issuer)).toThrow('transaction account')
  })

  it('requires explicit unbounded expiry and refuses to wait on it', async () => {
    const prepared = await draft().prepareMultisig({
      signersCount: 1,
      expiry: 'none',
    })
    expect(prepared.toJSON().LastLedgerSequence).toBeUndefined()
    expect(prepared.sign(signer).toBlob()).toEqual(expect.any(String))
    const outcome = await prepared.sign(signer).trySubmit()
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error.message).toContain('bounded expiry')
    }
  })

  it('preserves preparation and transport errors through the try methods', async () => {
    const offline = new Error('connection lost; outcome unknown')
    jest.spyOn(client, 'autofill').mockRejectedValueOnce(offline)
    expect(await draft().tryMultisignAndSubmit([signer])).toEqual({
      ok: false,
      error: offline,
    })
    const signed = (await draft().prepareMultisig({ signersCount: 1 })).sign(
      signer,
    )
    jest.spyOn(client, 'submitAndWait').mockRejectedValue(offline)
    expect(await signed.trySubmit()).toEqual({ ok: false, error: offline })
  })

  it.each([0, -1, 1.5, 33, NaN])(
    'rejects invalid signature count %s before network access',
    async (signersCount) => {
      await expect(draft().prepareMultisig({ signersCount })).rejects.toThrow(
        'signersCount',
      )
      expect(client.autofill).not.toHaveBeenCalled()
    },
  )

  it('does not reuse fees or signatures supplied in the draft', async () => {
    const tx = client
      .forAccount(issuer.address)
      .tx.payment({ Amount: '1', Destination: destination.address, Fee: '10' })
    await expect(tx.prepareMultisig({ signersCount: 2 })).rejects.toThrow(
      'before setting Fee',
    )
  })
})
