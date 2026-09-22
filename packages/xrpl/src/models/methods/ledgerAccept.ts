import { BaseRequest, BaseResponse } from './baseMethod'

/**
 * The `ledger_accept` method forces the server to close the current ledger
 * and advance to the next one. Expects a response in the form of a
 * {@link LedgerAcceptResponse}.
 *
 * @remarks Admin-only. Only available on a server running in stand-alone
 * mode (`--standalone`); a networked server responds with `notStandAlone`.
 *
 * @example
 * ```ts
 * const ledgerAccept: LedgerAcceptRequest = {
 *   command: 'ledger_accept'
 * }
 * ```
 *
 * @category Requests
 */
export interface LedgerAcceptRequest extends BaseRequest {
  command: 'ledger_accept'
}

/**
 * Response expected from a {@link LedgerAcceptRequest}.
 *
 * @category Responses
 */
export interface LedgerAcceptResponse extends BaseResponse {
  result: {
    /** The ledger index of the newly created "current" ledger. */
    ledger_current_index: number
  }
}
