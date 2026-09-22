import { assert } from 'chai'

import { XrplError, NotFoundError, TransactionFailedError } from '../../src'

describe('client errors', function () {
  it('XrplError with data', async function () {
    const error = new XrplError('_message_', '_data_')
    assert.strictEqual(error.toString(), '[XrplError(_message_, "_data_")]')
  })

  it('NotFoundError default message', async function () {
    const error = new NotFoundError()
    assert.strictEqual(error.toString(), '[NotFoundError(Not found)]')
  })

  it('TransactionFailedError exposes the engine result and phase', async function () {
    const error = new TransactionFailedError(
      'Transaction failed, tefPAST_SEQ: This sequence number has already passed.',
      {
        engineResult: 'tefPAST_SEQ',
        engineResultMessage: 'This sequence number has already passed.',
        phase: 'submit',
      },
      { engine_result: 'tefPAST_SEQ' },
    )
    assert.instanceOf(error, XrplError)
    assert.strictEqual(error.name, 'TransactionFailedError')
    assert.strictEqual(error.engineResult, 'tefPAST_SEQ')
    assert.strictEqual(
      error.engineResultMessage,
      'This sequence number has already passed.',
    )
    assert.strictEqual(error.phase, 'submit')
    assert.strictEqual(
      error.toString(),
      '[TransactionFailedError(Transaction failed, tefPAST_SEQ: This sequence number has already passed., {"engine_result":"tefPAST_SEQ"})]',
    )
  })

  it('TransactionFailedError leaves engineResultMessage undefined when rippled gave none', async function () {
    const error = new TransactionFailedError('expired', {
      engineResult: 'terQUEUED',
      phase: 'expired',
    })
    assert.isUndefined(error.engineResultMessage)
    assert.isUndefined(error.data)
    assert.strictEqual(error.phase, 'expired')
  })
})
