import {
  AccountRoot,
  Amendments,
  AMM,
  Bridge,
  Check,
  Credential,
  Delegate,
  DepositPreauth,
  DID,
  DirectoryNode,
  Escrow,
  FeeSettings,
  LedgerHashes,
  Loan,
  LoanBroker,
  MPToken,
  MPTokenIssuance,
  NFTokenOffer,
  NFTokenPage,
  Offer,
  Oracle,
  PayChannel,
  RippleState,
  SignerList,
  Sponsorship,
  Ticket,
  Vault,
  XChainOwnedClaimID,
  XChainOwnedCreateAccountClaimID,
} from '../ledger'
import { LedgerEntry, LedgerEntryFilter } from '../ledger/LedgerEntry'
import PermissionedDomain from '../ledger/PermissionedDomain'

import { BaseRequest, BaseResponse, LookupByLedgerRequest } from './baseMethod'

export type AccountObjectType = Exclude<
  LedgerEntryFilter,
  'amendments' | 'fee' | 'hashes'
>
/**
 * The account_objects command returns the raw ledger format for all objects
 * owned by an account. For a higher-level view of an account's trust lines and
 * balances, see the account_lines method instead. Expects a response in the
 * form of an {@link AccountObjectsResponse}.
 *
 * @category Requests
 */
export interface AccountObjectsRequest
  extends BaseRequest, LookupByLedgerRequest {
  command: 'account_objects'
  /** A unique identifier for the account, most commonly the account's address. */
  account: string
  /**
   * If included, filter results to include only this type of ledger object.
   */
  type?: AccountObjectType
  /**
   * If true, the response only includes objects that would block this account
   * from being deleted. The default is false.
   */
  deletion_blockers_only?: boolean
  /**
   * (Optional) Filter results based on sponsorship status. If true, returns only
   * sponsored objects. If false, returns only non-sponsored objects. If omitted,
   * returns all objects regardless of sponsorship status.
   */
  sponsored?: boolean
  /**
   * The maximum number of objects to include in the results. Must be within
   * the inclusive range 10 to 400 on non-admin connections. The default is 200.
   */
  limit?: number
  /**
   * Value from a previous paginated response. Resume retrieving data where
   * that response left off.
   */
  marker?: unknown
}

/**
 * Account Objects can be a Check, a DepositPreauth, an Escrow, an Offer, a
 * PayChannel, a SignerList, a Ticket, or a RippleState.
 */
export type AccountObject = Exclude<
  LedgerEntry,
  Amendments | FeeSettings | LedgerHashes
>

/**
 * Maps each `account_objects` `type` filter to the ledger entry type the
 * filtered response contains.
 */
export interface AccountObjectByFilter {
  account: AccountRoot
  amm: AMM
  bridge: Bridge
  check: Check
  credential: Credential
  delegate: Delegate
  deposit_preauth: DepositPreauth
  did: DID
  directory: DirectoryNode
  escrow: Escrow
  loan: Loan
  loan_broker: LoanBroker
  mpt_issuance: MPTokenIssuance
  mptoken: MPToken
  nft_offer: NFTokenOffer
  nft_page: NFTokenPage
  offer: Offer
  oracle: Oracle
  payment_channel: PayChannel
  permissioned_domain: PermissionedDomain
  signer_list: SignerList
  sponsorship: Sponsorship
  state: RippleState
  ticket: Ticket
  vault: Vault
  xchain_owned_create_account_claim_id: XChainOwnedCreateAccountClaimID
  xchain_owned_claim_id: XChainOwnedClaimID
}

/**
 * Response expected from an {@link AccountObjectsRequest}. `T` is the entry
 * type of the returned objects: the full {@link AccountObject} union by
 * default, or the entry type a `type` filter selects (see
 * {@link AccountObjectsResponseMap}).
 *
 * @category Responses
 */
export interface AccountObjectsResponse<
  T extends AccountObject = AccountObject,
> extends BaseResponse {
  result: {
    /** Unique Address of the account this request corresponds to. */
    account: string
    /**
     * Array of objects owned by this account. Each object is in its raw
     * ledger format.
     */
    account_objects: T[]
    /**
     * The identifying hash of the ledger that was used to generate this
     * response.
     */
    ledger_hash?: string
    /**
     * The ledger index of the ledger version that was used to generate this
     * response.
     */
    ledger_index?: number
    /**
     * The ledger index of the current in-progress ledger version, which was
     * used to generate this response.
     */
    ledger_current_index?: number
    /** The limit that was used in this request, if any. */
    limit?: number
    /**
     * Server-defined value indicating the response is paginated. Pass this to
     * the next call to resume where this call left off. Omitted when there are
     * no additional pages after this one.
     */
    marker?: string
    /**
     * If included and set to true, the information in this response comes from
     * a validated ledger version. Otherwise, the information is subject to
     * change.
     */
    validated?: boolean
  }
}

/**
 * Type to map an `account_objects` request to its response: when the request
 * sets a `type` filter, `account_objects` is narrowed to that entry type;
 * otherwise it stays the full {@link AccountObject} union.
 *
 * @category Responses
 */
export type AccountObjectsResponseMap<T> = T extends {
  type: infer K extends AccountObjectType
}
  ? AccountObjectsResponse<AccountObjectByFilter[K]>
  : AccountObjectsResponse
