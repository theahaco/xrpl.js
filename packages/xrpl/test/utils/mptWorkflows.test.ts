import {
  Client,
  decodeMemo,
  encodeMemo,
  MPTokenFlags,
  MPTokenIssuanceFlags,
  RippledError,
} from '../../src'

const client = new Client('ws://localhost:6006')
const issuer = 'issuer'
const holder = 'holder'
const issuanceId = 'id'
const input = {
  account: issuer,
  destination: holder,
  mptIssuanceId: issuanceId,
  amount: '10',
}

describe('MPT workflow helpers', () => {
  beforeEach(() => jest.spyOn(client, 'getLedgerIndex').mockResolvedValue(42))
  afterEach(() => jest.restoreAllMocks())

  it('roundtrips UTF-8 memos and rejects malformed binary/text', () => {
    const text = { type: 'mint-period', data: '2026 🌍', format: 'text/plain' }
    expect(decodeMemo(encodeMemo(text))).toEqual(text)
    expect(encodeMemo({ data: '' })).toEqual({ Memo: { MemoData: '' } })
    expect(() => decodeMemo({ Memo: { MemoData: '0' } })).toThrow()
    expect(() => decodeMemo({ Memo: { MemoData: 'GG' } })).toThrow()
    expect(() => decodeMemo({ Memo: { MemoData: 'FF' } })).toThrow()
  })

  it('pins reads to one ledger and distinguishes self-authorization from issuer authorization', async () => {
    const request = jest
      .spyOn(client, 'request')
      .mockResolvedValueOnce({
        result: {
          node: {
            Issuer: issuer,
            Flags: MPTokenIssuanceFlags.lsfMPTRequireAuth,
            OutstandingAmount: '0',
          },
        },
      } as never)
      .mockResolvedValueOnce({ result: { node: { Flags: 0 } } } as never)
    const result = await client.getMptTransferReadiness(input)
    expect(result.status).toBe('blocked')
    expect(result.checks[0].message).toContain('authorized by the issuer')
    expect(result.notChecked).toContain('XRP fees and reserves')
    for (const [query] of request.mock.calls) {
      expect(query).toHaveProperty('ledger_index', 42)
    }
  })

  it('reports domain credentials as unknown instead of declaring the holder ineligible', async () => {
    jest
      .spyOn(client, 'request')
      .mockResolvedValueOnce({
        result: {
          node: {
            Issuer: issuer,
            Flags: MPTokenIssuanceFlags.lsfMPTRequireAuth,
            DomainID: 'domain',
            OutstandingAmount: '0',
          },
        },
      } as never)
      .mockResolvedValueOnce({ result: { node: { Flags: 0 } } } as never)
    expect((await client.getMptTransferReadiness(input)).status).toBe('unknown')
  })

  it('checks global locks and supply caps even when the destination has a holding', async () => {
    jest
      .spyOn(client, 'request')
      .mockResolvedValueOnce({
        result: {
          node: {
            Issuer: issuer,
            Flags: MPTokenIssuanceFlags.lsfMPTLocked,
            OutstandingAmount: '95',
            MaximumAmount: '100',
          },
        },
      } as never)
      .mockResolvedValueOnce({ result: { node: { Flags: 0 } } } as never)
    const { checks } = await client.getMptTransferReadiness(input)
    expect(checks.filter((check) => check.status === 'blocked')).toHaveLength(2)
  })

  it('does not block redemption solely because a holding is locked or transfers disabled', async () => {
    jest
      .spyOn(client, 'request')
      .mockResolvedValueOnce({
        result: {
          node: {
            Issuer: issuer,
            Flags: MPTokenIssuanceFlags.lsfMPTLocked,
            OutstandingAmount: '100',
          },
        },
      } as never)
      .mockResolvedValueOnce({
        result: { node: { Flags: MPTokenFlags.lsfMPTLocked, MPTAmount: '10' } },
      } as never)
    expect(
      (
        await client.getMptTransferReadiness({
          ...input,
          account: holder,
          destination: issuer,
        })
      ).status,
    ).toBe('eligible')
  })

  it('preserves network failures and represents only entryNotFound as absence', async () => {
    const offline = new Error('Offline')
    jest.spyOn(client, 'request').mockRejectedValueOnce(offline)
    await expect(client.getMptTransferReadiness(input)).rejects.toBe(offline)
    jest
      .spyOn(client, 'request')
      .mockRejectedValueOnce(
        new RippledError('Missing', { error: 'entryNotFound' }),
      )
    expect((await client.getMptTransferReadiness(input)).status).toBe('blocked')
  })

  it('paginates and includes only validated successful outgoing payments of this issuance', async () => {
    const payment = {
      validated: true,
      ledger_index: 40,
      meta: { TransactionResult: 'tesSUCCESS' },
      tx: {
        TransactionType: 'Payment',
        Account: issuer,
        Destination: holder,
        Amount: { mpt_issuance_id: issuanceId, value: '10' },
        Memos: [encodeMemo({ type: 'mint-period', data: '2026' })],
      },
    }
    const request = jest
      .spyOn(client, 'request')
      .mockResolvedValueOnce({
        result: {
          ledger_index_min: 1,
          ledger_index_max: 42,
          marker: { ledger: 20 },
          transactions: [
            payment,
            { ...payment, validated: false },
            { ...payment, meta: { TransactionResult: 'tecNO_AUTH' } },
            { ...payment, tx: { ...payment.tx, Account: holder } },
            {
              ...payment,
              tx: {
                ...payment.tx,
                Amount: { mpt_issuance_id: 'other', value: '10' },
              },
            },
          ],
        },
      } as never)
      .mockResolvedValueOnce({
        result: {
          ledger_index_min: 1,
          ledger_index_max: 42,
          transactions: [
            {
              ...payment,
              meta: {
                TransactionResult: 'tesSUCCESS',
                delivered_amount: { mpt_issuance_id: issuanceId, value: '3' },
              },
            },
            {
              ...payment,
              tx: { ...payment.tx, Flags: 0x00020000 },
              meta: {
                TransactionResult: 'tesSUCCESS',
                delivered_amount: 'unavailable',
              },
            },
          ],
        },
      } as never)
    const result = await client.getMptPaymentHistory(issuer, issuanceId)
    expect(result.payments.map((entry) => entry.deliveredAmount)).toEqual([
      '10',
      '3',
      undefined,
    ])
    expect(result).toMatchObject({ ledgerIndexMin: 1, ledgerIndexMax: 42 })
    expect(request.mock.calls[1][0]).toMatchObject({
      ledger_index_min: 1,
      ledger_index_max: 42,
      marker: { ledger: 20 },
    })
  })

  it('fails on repeated markers or changed ranges instead of returning incomplete history', async () => {
    const request = jest.spyOn(client, 'request').mockResolvedValue({
      result: {
        ledger_index_min: 1,
        ledger_index_max: 42,
        marker: 'again',
        transactions: [],
      },
    } as never)
    await expect(
      client.getMptPaymentHistory(issuer, issuanceId),
    ).rejects.toThrow('repeated')
    request.mockResolvedValue({
      result: { ledger_index_min: 1, ledger_index_max: 41, transactions: [] },
    } as never)
    await expect(
      client.getMptPaymentHistory(issuer, issuanceId),
    ).rejects.toThrow('range')
  })
})
