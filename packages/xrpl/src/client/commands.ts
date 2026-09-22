import type {
  BaseRequest,
  Request,
  RequestAPIVersion,
  RequestResponseMap,
} from '../models/methods'

import { commandNames } from './registries'

import type { Client } from '.'

type WithoutCommand<T> = T extends unknown ? Omit<T, 'command'> : never
type Keys<T> = T extends unknown ? keyof T : never
type Fields<C extends Request['command']> = WithoutCommand<
  Extract<Request, { command: C }>
>
type Checked<F, Allowed> = F & {
  [K in Exclude<keyof F, Keys<Allowed>>]?: never
}

type CommandMethod<C extends Request['command']> = <
  const F extends Fields<C> = Fields<C>,
>(
  ...args: Record<never, never> extends Fields<C>
    ? [fields?: Checked<F, Fields<C>>]
    : [fields: Checked<F, Fields<C>>]
) => Promise<RequestResponseMap<F & { command: C }, RequestAPIVersion<F>>>

/** Modeled commands with inferred, version-aware responses. */
type CommandMethods = {
  readonly [C in keyof typeof commandNames as (typeof commandNames)[C]]: CommandMethod<C>
}

/** Documented methods whose signatures follow the mapped models. */
export interface Commands extends CommandMethods {
  /**
   * The account_channels method returns information about an account's
   * Payment Channels. This includes only channels where the specified
   * account is the channel's source, not the destination. (A channel's
   * "source" and "owner" are the same.) All information retrieved is
   * relative to a particular version of the ledger. Returns an {@link
   * AccountChannelsResponse}.
   */
  readonly accountChannels: CommandMethods['accountChannels']
  /**
   * The `account_currencies` command retrieves a list of currencies that an
   * account can send or receive, based on its trust lines. Expects an
   * {@link AccountCurrenciesResponse}.
   */
  readonly accountCurrencies: CommandMethods['accountCurrencies']
  /**
   * The `account_info` command retrieves information about an account, its
   * activity, and its XRP balance. All information retrieved is relative to
   * a particular version of the ledger. Returns an {@link
   * AccountInfoResponse}.
   */
  readonly accountInfo: CommandMethods['accountInfo']
  /**
   * The account_lines method returns information about an account's trust
   * lines, including balances in all non-XRP currencies and assets. All
   * information retrieved is relative to a particular version of the
   * ledger. Expects an {@link AccountLinesResponse}.
   */
  readonly accountLines: CommandMethods['accountLines']
  /**
   * The `account_nfts` method retrieves all of the NFTs currently owned by
   * the specified account.
   */
  readonly accountNfts: CommandMethods['accountNfts']
  /**
   * The account_objects command returns the raw ledger format for all
   * objects owned by an account. For a higher-level view of an account's
   * trust lines and balances, see the account_lines method instead. Expects
   * a response in the form of an {@link AccountObjectsResponse}.
   */
  readonly accountObjects: CommandMethods['accountObjects']
  /**
   * The account_offers method retrieves a list of offers made by a given
   * account that are outstanding as of a particular ledger version. Expects
   * a response in the form of a {@link AccountOffersResponse}.
   */
  readonly accountOffers: CommandMethods['accountOffers']
  /**
   * The account_sponsoring command returns information about accounts and
   * ledger objects that are sponsored by the specified account. This is a
   * Clio-only method that provides details about sponsorship relationships
   * for XLS-68. Expects a response in the form of an {@link
   * AccountSponsoringResponse}.
   */
  readonly accountSponsoring: CommandMethods['accountSponsoring']
  /**
   * The account_tx method retrieves a list of transactions that involved
   * the specified account. Expects a response in the form of a {@link *
   * AccountTxResponse}.
   */
  readonly accountTx: CommandMethods['accountTx']
  /**
   * The `amm_info` method gets information about an Automated Market Maker
   * (AMM) instance. Returns an {@link AMMInfoResponse}.
   */
  readonly ammInfo: CommandMethods['ammInfo']
  /**
   * The book_offers method retrieves a list of offers, also known as the
   * order. Book, between two currencies. Returns an {@link
   * BookOffersResponse}.
   */
  readonly bookOffers: CommandMethods['bookOffers']
  /**
   * The `channel_verify` method checks the validity of a signature that can
   * be used to redeem a specific amount of XRP from a payment channel.
   * Expects a response in the form of a {@link ChannelVerifyResponse}.
   */
  readonly channelVerify: CommandMethods['channelVerify']
  /**
   * The deposit_authorized command indicates whether one account is
   * authorized to send payments directly to another. Expects a response in
   * the form of a {@link * DepositAuthorizedResponse}.
   */
  readonly depositAuthorized: CommandMethods['depositAuthorized']
  /** Send a feature request. */
  readonly feature: CommandMethods['feature']
  /**
   * The `fee` command reports the current state of the open-ledger
   * requirements for the transaction cost. This requires the FeeEscalation
   * amendment to be enabled. Expects a response in the form of a {@link
   * FeeResponse}.
   */
  readonly fee: CommandMethods['fee']
  /**
   * The gateway_balances command calculates the total balances issued by a
   * given account, optionally excluding amounts held by operational
   * addresses. Expects a response in the form of a {@link
   * GatewayBalancesResponse}.
   */
  readonly gatewayBalances: CommandMethods['gatewayBalances']
  /**
   * The `get_aggregate_price` method retrieves the aggregate price of
   * specified Oracle objects, returning three price statistics: mean,
   * median, and trimmed mean. Returns an {@link GetAggregatePriceResponse}.
   */
  readonly getAggregatePrice: CommandMethods['getAggregatePrice']
  /**
   * Retrieve information about the public ledger. Expects a response in the
   * form of a {@link LedgerResponse}.
   */
  readonly ledger: CommandMethods['ledger']
  /**
   * The `ledger_accept` method forces the server to close the current
   * ledger and advance to the next one. Expects a response in the form of a
   * {@link LedgerAcceptResponse}.
   */
  readonly ledgerAccept: CommandMethods['ledgerAccept']
  /**
   * The ledger_closed method returns the unique identifiers of the most
   * recently closed ledger. Expects a response in the form of a {@link *
   * LedgerClosedResponse}.
   */
  readonly ledgerClosed: CommandMethods['ledgerClosed']
  /**
   * The ledger_current method returns the unique identifiers of the current
   * in-progress ledger. Expects a response in the form of a {@link *
   * LedgerCurrentResponse}.
   */
  readonly ledgerCurrent: CommandMethods['ledgerCurrent']
  /**
   * The `ledger_data` method retrieves contents of the specified ledger.
   * You can iterate through several calls to retrieve the entire contents
   * of a single ledger version.
   */
  readonly ledgerData: CommandMethods['ledgerData']
  /**
   * The `ledger_entry` method returns a single ledger object from the XRP
   * Ledger in its raw format. Expects a response in the form of a {@link *
   * LedgerEntryResponse}.
   */
  readonly ledgerEntry: CommandMethods['ledgerEntry']
  /**
   * The `manifest` method reports the current "manifest" information for a
   * given validator public key. The "manifest" is the public portion of
   * that validator's configured token. Expects a response in the form of a
   * {@link * ManifestResponse}.
   */
  readonly manifest: CommandMethods['manifest']
  /**
   * The `nft_buy_offers` method retrieves all of buy offers for the
   * specified NFToken.
   */
  readonly nftBuyOffers: CommandMethods['nftBuyOffers']
  /**
   * The nft_history method retrieves a list of transactions that involved
   * the specified NFToken. Expects a response in the form of a {@link *
   * NFTHistoryResponse}.
   */
  readonly nftHistory: CommandMethods['nftHistory']
  /** The `nft_info` method retrieves information about an NFToken. */
  readonly nftInfo: CommandMethods['nftInfo']
  /**
   * The `nft_sell_offers` method retrieves all of sell offers for the
   * specified NFToken.
   */
  readonly nftSellOffers: CommandMethods['nftSellOffers']
  /**
   * The nfts_by_issuer method returns a list of NFTokens issued by the
   * account. The order of the NFTs is not associated with the date the NFTs
   * were minted. Expects a response in the form of a {@link *
   * NFTsByIssuerResponse}.
   */
  readonly nftsByIssuer: CommandMethods['nftsByIssuer']
  /**
   * The `noripple_check` command provides a quick way to check the status
   * of th default ripple field for an account and the No Ripple flag of its
   * trust lines, compared with the recommended settings. Expects a response
   * in the form of an {@link NoRippleCheckResponse}.
   */
  readonly norippleCheck: CommandMethods['norippleCheck']
  /** Get the information of the currently-open pathfinding request. */
  readonly pathFind: CommandMethods['pathFind']
  /**
   * The ping command returns an acknowledgement, so that clients can test
   * the connection status and latency. Expects a response in the form of a
   * {@link * PingResponse}.
   */
  readonly ping: CommandMethods['ping']
  /**
   * The random command provides a random number to be used as a source of
   * entropy for random number generation by clients. Expects a response in
   * the form of a {@link RandomResponse}.
   */
  readonly random: CommandMethods['random']
  /**
   * The `ripple_path_find` method is a simplified version of the path_find
   * method that provides a single response with a payment path you can use
   * right away. Expects a response in the form of a {@link
   * RipplePathFindResponse}.
   */
  readonly ripplePathFind: CommandMethods['ripplePathFind']
  /**
   * The `server_definitions` method retrieves information about the
   * definition enums available in this rippled node. Expects a response in
   * the form of a {@link ServerDefinitionsResponse}.
   */
  readonly serverDefinitions: CommandMethods['serverDefinitions']
  /**
   * The `server_info` command asks the server for a human-readable version
   * of various information about the rippled server being queried. Expects
   * a response in the form of a {@link ServerInfoResponse}.
   */
  readonly serverInfo: CommandMethods['serverInfo']
  /**
   * The `server_state` command asks the server for various machine-readable
   * information about the rippled server's current state. The response is
   * almost the same as the server_info method, but uses units that are
   * easier to process instead of easier to read.
   */
  readonly serverState: CommandMethods['serverState']
  /** Send a simulate request. */
  readonly simulate: CommandMethods['simulate']
  /**
   * The submit method applies a transaction and sends it to the network to
   * be confirmed and included in future ledgers. Expects a response in the
   * form of a {@link SubmitResponse}.
   */
  readonly submit: CommandMethods['submit']
  /**
   * The `submit_multisigned` command applies a multi-signed transaction and
   * sends it to the network to be included in future ledgers. Expects a
   * response in the form of a {@link SubmitMultisignedRequest}.
   */
  readonly submitMultisigned: CommandMethods['submitMultisigned']
  /**
   * The subscribe method requests periodic notifications from the server
   * when certain events happen. Expects a response in the form of a {@link
   * SubscribeResponse}.
   */
  readonly subscribe: CommandMethods['subscribe']
  /**
   * The `transaction_entry` method retrieves information on a single
   * transaction from a specific ledger version. Expects a response in the
   * form of a {@link TransactionEntryResponse}.
   */
  readonly transactionEntry: CommandMethods['transactionEntry']
  /**
   * The tx method retrieves information on a single transaction, by its
   * identifying hash. Expects a response in the form of a {@link
   * TxResponse}.
   */
  readonly tx: CommandMethods['tx']
  /**
   * The unsubscribe command tells the server to stop sending messages for a
   * particular subscription or set of subscriptions. Expects a response in
   * the form of an {@link UnsubscribeResponse}.
   */
  readonly unsubscribe: CommandMethods['unsubscribe']
  /**
   * The `vault_info` method gets information about a Vault instance.
   * Returns an {@link VaultInfoResponse}.
   */
  readonly vaultInfo: CommandMethods['vaultInfo']
}

/**
 * Bind the complete command registry to an existing client.
 *
 * @param client - Connection used for requests.
 * @returns Discoverable command methods.
 */
export function createCommands(client: Client): Commands {
  // The checked registry fixes each discriminator; the public method types check its fields.
  return Object.freeze(
    Object.fromEntries(
      Object.entries(commandNames).map(([command, name]) => [
        name,
        async (fields: Record<string, unknown> = {}) =>
          client.request({ ...fields, command } as BaseRequest),
      ]),
    ),
  ) as unknown as Commands
}
