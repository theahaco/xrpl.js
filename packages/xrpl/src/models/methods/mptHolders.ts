import { BaseRequest, BaseResponse, LookupByLedgerRequest } from './baseMethod'

/**
 * The `mpt_holders` method lists every account that holds an MPToken for a
 * given MPTokenIssuance, with each holder's balance and flags.
 *
 * **Clio only.** rippled does not implement this method and answers it with
 * a {@link RippledError} whose `code` is `unknownCmd`. rippled offers no
 * other way to enumerate the holders of an issuance: `account_objects` lists
 * the MPTokens of one *holder*, and `ledger_entry` needs the holder's address
 * up front. An issuer that must act on "every holder" (for example to lock or
 * claw back from all of them) has to either query a Clio server or keep its
 * own registry of holders.
 *
 * Expects a response in the form of an {@link MPTHoldersResponse}.
 *
 * @category Requests
 */
export interface MPTHoldersRequest extends BaseRequest, LookupByLedgerRequest {
  command: 'mpt_holders'
  /**
   * The 192-bit MPTokenIssuanceID, as a 48-character hex string.
   */
  mpt_issuance_id: string
  /**
   * Value from a previous paginated response. Resume retrieving data where
   * that response left off.
   */
  marker?: unknown
  /**
   * Limit the number of holders to retrieve. The server is not required to
   * honor this value.
   */
  limit?: number
}

/**
 * One holder of an MPTokenIssuance, as returned by {@link MPTHoldersResponse}.
 *
 * @category Responses
 */
export interface MPTHolder {
  /** The address of the account that holds the MPToken. */
  account: string
  /** The flags set on the holder's MPToken ledger entry. */
  flags: number
  /** The amount of tokens the holder currently holds, as a decimal string. */
  mpt_amount: string
  /**
   * The amount of the holder's tokens that is currently locked (for example
   * by an escrow), as a decimal string. Omitted when nothing is locked.
   */
  locked_amount?: string
  /** The ledger index (key) of the holder's MPToken ledger entry. */
  mptoken_index: string
}

/**
 * Response expected from an {@link MPTHoldersRequest}.
 *
 * @category Responses
 */
export interface MPTHoldersResponse extends BaseResponse {
  result: {
    /** The MPTokenIssuanceID that was queried. */
    mpt_issuance_id: string
    /** The holders of the issuance in this page. */
    mptokens: MPTHolder[]
    /**
     * Server-defined value indicating the response is paginated. Pass this
     * to the next call to resume where this call left off. Omitted when there
     * are no more holders.
     */
    marker?: unknown
    /** The limit value used in the request. */
    limit?: number
    /** The ledger index of the ledger version that was used. */
    ledger_index: number
    /** Whether this data comes from a validated ledger. Always true on Clio. */
    validated: boolean
  }
}
