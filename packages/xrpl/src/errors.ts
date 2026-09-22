/* eslint-disable max-classes-per-file -- Errors can be defined in the same file */
/**
 * Base Error class for xrpl.js. All Errors thrown by xrpl.js should throw
 * XrplErrors.
 *
 * @category Errors
 */
class XrplError extends Error {
  public readonly name: string
  public readonly message: string
  public readonly data?: unknown

  /**
   * Construct an XrplError.
   *
   * @param message - The error message.
   * @param data - The data that caused the error.
   */
  public constructor(message = '', data?: unknown) {
    super(message)

    this.name = this.constructor.name
    this.message = message
    this.data = data
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `captureStackTrace` can be null in browsers
    if (Error.captureStackTrace != null) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  /**
   * Converts the Error to a human-readable String form.
   *
   * @returns The String output of the Error.
   */
  public toString(): string {
    let result = `[${this.name}(${this.message}`
    if (this.data) {
      result += `, ${JSON.stringify(this.data)}`
    }
    result += ')]'
    return result
  }

  /**
   * Console.log in node uses util.inspect on object, and util.inspect allows
   * us to customize its output:
   * https://nodejs.org/api/util.html#util_custom_inspect_function_on_objects.
   *
   * @returns The String output of the Error.
   */
  public inspect(): string {
    return this.toString()
  }
}

/**
 * Error thrown when rippled responds with an error.
 *
 * @category Errors
 */
class RippledError extends XrplError {}

/**
 * Error thrown when xrpl.js cannot specify error type.
 *
 * @category Errors
 */
class UnexpectedError extends XrplError {}

/**
 * Error thrown when xrpl.js has an error with connection to rippled.
 *
 * @category Errors
 */
class ConnectionError extends XrplError {}

/**
 * Error thrown when xrpl.js is not connected to rippled server.
 *
 * @category Errors
 */
class NotConnectedError extends ConnectionError {}

/**
 * Error thrown when xrpl.js has disconnected from rippled server.
 *
 * @category Errors
 */
class DisconnectedError extends ConnectionError {}

/**
 * Error thrown when rippled is not initialized.
 *
 * @category Errors
 */
class RippledNotInitializedError extends ConnectionError {}

/**
 * Error thrown when xrpl.js times out.
 *
 * @category Errors
 */
class TimeoutError extends ConnectionError {}

/**
 * Error thrown when xrpl.js sees a response in the wrong format.
 *
 * @category Errors
 */
class ResponseFormatError extends ConnectionError {}

/**
 * Error thrown when xrpl.js sees a malformed transaction.
 *
 * @category Errors
 */
class ValidationError extends XrplError {}

/**
 * Error thrown by `submitAndWait` when a transaction will never reach a validated ledger.
 *
 * It is thrown in two situations, distinguished by `phase`:
 * - `'submit'`: the preliminary result of the `submit` request was terminal (`tem*`,
 *   `tef*` or `tel*`), so rippled neither applied, queued, nor relayed the transaction.
 * - `'expired'`: the transaction's `LastLedgerSequence` was passed by the validated
 *   ledger without the transaction being included in a validated ledger.
 *
 * A validated `tec*` result does NOT throw this error: the transaction reached a
 * validated ledger (and charged its fee), so `submitAndWait` resolves and the code is
 * in `result.meta.TransactionResult`. See `getTransactionResultCode` and `isTesSuccess`.
 *
 * @category Errors
 */
class TransactionFailedError extends XrplError {
  /** The engine result code, e.g. `temMALFORMED`, `tefPAST_SEQ`, `terQUEUED`. */
  public readonly engineResult: string
  /** rippled's human-readable description of `engineResult`, when it was available. */
  public readonly engineResultMessage: string | undefined
  /** Whether the failure was detected at submission or after `LastLedgerSequence` passed. */
  public readonly phase: 'submit' | 'expired'

  /**
   * Construct a TransactionFailedError.
   *
   * @param message - The error message.
   * @param details - The engine result that caused the failure and the phase it was detected in.
   * @param details.engineResult - The engine result code.
   * @param details.engineResultMessage - rippled's description of the engine result, if any.
   * @param details.phase - `'submit'` for a terminal preliminary result, `'expired'` when `LastLedgerSequence` passed.
   * @param data - The data that caused the error (the `submit` result, when available).
   */
  public constructor(
    message: string,
    details: {
      engineResult: string
      engineResultMessage?: string
      phase: 'submit' | 'expired'
    },
    data?: unknown,
  ) {
    super(message, data)
    this.engineResult = details.engineResult
    this.engineResultMessage = details.engineResultMessage
    this.phase = details.phase
  }
}

/**
 * Error thrown when a client cannot generate a wallet from the testnet/devnet
 * faucets, or when the client cannot infer the faucet URL (i.e. when the Client
 * is connected to mainnet).
 *
 * @category Errors
 */
class XRPLFaucetError extends XrplError {}

/**
 * Error thrown when xrpl.js cannot retrieve a transaction, ledger, account, etc.
 * From rippled.
 *
 * @category Errors
 */
class NotFoundError extends XrplError {
  /**
   * Construct an XrplError.
   *
   * @param message - The error message. Defaults to "Not found".
   */
  public constructor(message = 'Not found') {
    super(message)
  }
}

export {
  XrplError,
  UnexpectedError,
  ConnectionError,
  RippledError,
  NotConnectedError,
  DisconnectedError,
  RippledNotInitializedError,
  TimeoutError,
  ResponseFormatError,
  ValidationError,
  NotFoundError,
  TransactionFailedError,
  XRPLFaucetError,
}
