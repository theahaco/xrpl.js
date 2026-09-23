import type { SuccessfulTxResponse, SubmitResult } from '../models/methods'
import type {
  StrictTransaction,
  SubmittableTransaction,
} from '../models/transactions'
import type { Wallet } from '../Wallet'

import { transactionNames } from './registries'
import { TransactionDraft } from './TransactionDraft'

import type { Client } from '.'

type InputKeys<T> = T extends unknown ? keyof T : never

type Model<Name extends SubmittableTransaction['TransactionType']> = Extract<
  SubmittableTransaction,
  { TransactionType: Name }
>

/** Fields for a wallet-bound draft. Account defaults to the bound account. */
export type TransactionInput<T extends SubmittableTransaction> =
  T extends unknown
    ? Omit<T, 'Account' | 'TransactionType'> & { Account?: T['Account'] }
    : never

/** A draft with a local signing wallet; preparing it still sends nothing. */
export class TransactionBuilder<
  T extends SubmittableTransaction,
> extends TransactionDraft<T> {
  private readonly wallet: Wallet

  /**
   * Bind a draft to its local signer.
   *
   * @param client - Connection used to prepare and submit.
   * @param wallet - Local signing wallet, possibly a regular key.
   * @param transaction - Complete draft.
   */
  public constructor(client: Client, wallet: Wallet, transaction: T) {
    super(client, transaction)
    this.wallet = wallet
  }

  /**
   * Prepare, locally sign and await validated success.
   *
   * @returns The successful transaction response.
   * @throws Error if preparation, signing, submission or the transaction fails.
   */
  public async signAndSubmit(): Promise<SuccessfulTxResponse<T>> {
    // The factory checks the exact model fields before storing this draft.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Factory validated the exact fields.
    return this.client.submitAndWait<T>(this.toJSON() as StrictTransaction<T>, {
      wallet: this.wallet,
    })
  }

  /**
   * Prepare, sign and submit with an explicit success/error outcome.
   *
   * @returns A result to handle through its ok discriminant.
   */
  public async trySignAndSubmit(): Promise<SubmitResult<T>> {
    // The factory checks the exact model fields before storing this draft.

    return this.client.trySubmitAndWait<T>(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Factory validates fields.
      this.toJSON() as StrictTransaction<T>,
      {
        wallet: this.wallet,
      },
    )
  }
}

type Registry = typeof transactionNames

/** All user-submittable transactions, excluding validator pseudo-transactions. */
type TransactionBuilderMethods<Signing extends boolean = true> = {
  readonly [Name in keyof Registry as Registry[Name]]: <
    const F extends TransactionInput<Model<Name>>,
  >(
    fields: F & {
      [K in Exclude<keyof F, InputKeys<TransactionInput<Model<Name>>>>]?: never
    },
  ) => Signing extends true
    ? TransactionBuilder<Model<Name>>
    : TransactionDraft<Model<Name>>
}

/** Documented methods whose signatures follow the mapped models. */
export interface TransactionBuilders<
  Signing extends boolean = true,
> extends TransactionBuilderMethods<Signing> {
  /**
   * An AccountDelete transaction deletes an account and any objects it owns
   * in the XRP Ledger, if possible, sending the account's remaining XRP to
   * a specified destination account. Account defaults to the bound account.
   * With a local wallet, call signAndSubmit to send and await success.
   */
  readonly accountDelete: TransactionBuilderMethods<Signing>['accountDelete']
  /**
   * An AccountSet transaction modifies the properties of an account in the
   * XRP Ledger. Account defaults to the bound account. With a local wallet, call signAndSubmit
   * to send and await success.
   */
  readonly accountSet: TransactionBuilderMethods<Signing>['accountSet']
  /**
   * Bid on an Automated Market Maker's (AMM's) auction slot. Account
   * defaults to the bound account. With a local wallet, call signAndSubmit to send and await
   * success.
   */
  readonly ammBid: TransactionBuilderMethods<Signing>['ammBid']
  /**
   * Claw back tokens from a holder that has deposited your issued tokens
   * into an AMM pool. Account defaults to the bound account. With a local wallet, call
   * signAndSubmit to send and await success.
   */
  readonly ammClawback: TransactionBuilderMethods<Signing>['ammClawback']
  /**
   * Create a new Automated Market Maker (AMM) instance for trading a pair
   * of assets (fungible tokens or XRP). Account defaults to the bound
   * account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly ammCreate: TransactionBuilderMethods<Signing>['ammCreate']
  /**
   * Delete an empty Automated Market Maker (AMM) instance that could not be
   * fully deleted automatically. Account defaults to the bound account.
   * With a local wallet, call signAndSubmit to send and await success.
   */
  readonly ammDelete: TransactionBuilderMethods<Signing>['ammDelete']
  /**
   * Deposit funds into an Automated Market Maker (AMM) instance and receive
   * the AMM's liquidity provider tokens (LP Tokens) in exchange. Account
   * defaults to the bound account. With a local wallet, call signAndSubmit to send and await
   * success.
   */
  readonly ammDeposit: TransactionBuilderMethods<Signing>['ammDeposit']
  /**
   * Vote on the trading fee for an Automated Market Maker (AMM) instance.
   * Account defaults to the bound account. With a local wallet, call signAndSubmit to send and
   * await success.
   */
  readonly ammVote: TransactionBuilderMethods<Signing>['ammVote']
  /**
   * Withdraw assets from an Automated Market Maker (AMM) instance by
   * returning the AMM's liquidity provider tokens (LP Tokens). Account
   * defaults to the bound account. With a local wallet, call signAndSubmit to send and await
   * success.
   */
  readonly ammWithdraw: TransactionBuilderMethods<Signing>['ammWithdraw']
  /**
   * Create a Batch transaction draft. Account defaults to the bound
   * account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly batch: TransactionBuilderMethods<Signing>['batch']
  /**
   * Cancels an unredeemed Check, removing it from the ledger without
   * sending any money. The source or the destination of the check can
   * cancel a Check at any time using this transaction type. If the Check
   * has expired, any address can cancel it. Account defaults to the bound
   * account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly checkCancel: TransactionBuilderMethods<Signing>['checkCancel']
  /**
   * Attempts to redeem a Check object in the ledger to receive up to the
   * amount authorized by the corresponding CheckCreate transaction. Only
   * the Destination address of a Check can cash it with a CheckCash
   * transaction. Account defaults to the bound account. With a local wallet, call signAndSubmit
   * to send and await success.
   */
  readonly checkCash: TransactionBuilderMethods<Signing>['checkCash']
  /**
   * Create a Check object in the ledger, which is a deferred payment that
   * can be cashed by its intended destination. The sender of this
   * transaction is the sender of the Check. Account defaults to the bound
   * account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly checkCreate: TransactionBuilderMethods<Signing>['checkCreate']
  /**
   * The Clawback transaction is used by the token issuer to claw back
   * issued tokens from a holder. Account defaults to the bound account.
   * With a local wallet, call signAndSubmit to send and await success.
   */
  readonly clawback: TransactionBuilderMethods<Signing>['clawback']
  /**
   * The ConfidentialMPTClawback transaction lets an issuer claw back a
   * confidential MPT amount from a holder's confidential balance. Account
   * defaults to the bound account. With a local wallet, call signAndSubmit to send and await
   * success.
   */
  readonly confidentialMPTClawback: TransactionBuilderMethods<Signing>['confidentialMPTClawback']
  /**
   * The ConfidentialMPTConvert transaction moves a holder's public MPT
   * balance into their confidential (encrypted) balance. It is also used by
   * a holder to register their ElGamal encryption key for the issuance.
   * Account defaults to the bound account. With a local wallet, call signAndSubmit to send and
   * await success.
   */
  readonly confidentialMPTConvert: TransactionBuilderMethods<Signing>['confidentialMPTConvert']
  /**
   * The ConfidentialMPTConvertBack transaction moves a holder's
   * confidential (encrypted) balance back into their public MPT balance.
   * Account defaults to the bound account. With a local wallet, call signAndSubmit to send and
   * await success.
   */
  readonly confidentialMPTConvertBack: TransactionBuilderMethods<Signing>['confidentialMPTConvertBack']
  /**
   * The ConfidentialMPTMergeInbox transaction folds a holder's pending
   * confidential inbox balance into their spendable confidential balance.
   * Account defaults to the bound account. With a local wallet, call signAndSubmit to send and
   * await success.
   */
  readonly confidentialMPTMergeInbox: TransactionBuilderMethods<Signing>['confidentialMPTMergeInbox']
  /**
   * The ConfidentialMPTSend transaction transfers a confidential
   * (encrypted) MPT amount from the sender's confidential balance to a
   * destination's confidential inbox, without revealing the amount
   * on-ledger. Account defaults to the bound account. With a local wallet, call signAndSubmit to
   * send and await success.
   */
  readonly confidentialMPTSend: TransactionBuilderMethods<Signing>['confidentialMPTSend']
  /**
   * Accepts a credential issued to the Account (i.e. the Account is the
   * Subject of the Credential object). Credentials are represented in hex.
   * Whilst they are allowed a maximum length of 64 bytes, every byte
   * requires 2 hex characters for representation. The credential is not
   * considered valid until it has been transferred/accepted. Account
   * defaults to the bound account. With a local wallet, call signAndSubmit to send and await
   * success.
   */
  readonly credentialAccept: TransactionBuilderMethods<Signing>['credentialAccept']
  /**
   * Creates a Credential object. It must be sent by the issuer. Account
   * defaults to the bound account. With a local wallet, call signAndSubmit to send and await
   * success.
   */
  readonly credentialCreate: TransactionBuilderMethods<Signing>['credentialCreate']
  /**
   * Deletes a Credential object. Account defaults to the bound account.
   * With a local wallet, call signAndSubmit to send and await success.
   */
  readonly credentialDelete: TransactionBuilderMethods<Signing>['credentialDelete']
  /**
   * DelegateSet allows an account to delegate a set of permissions to
   * another account. Account defaults to the bound account. With a local wallet, call
   * signAndSubmit to send and await success.
   */
  readonly delegateSet: TransactionBuilderMethods<Signing>['delegateSet']
  /**
   * A DepositPreauth transaction gives another account pre-approval to
   * deliver payments to the sender of this transaction. This is only useful
   * if the sender of this transaction is using (or plans to use) Deposit
   * Authorization. Account defaults to the bound account. With a local wallet, call
   * signAndSubmit to send and await success.
   */
  readonly depositPreauth: TransactionBuilderMethods<Signing>['depositPreauth']
  /**
   * Create a DIDDelete transaction draft. Account defaults to the bound
   * account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly didDelete: TransactionBuilderMethods<Signing>['didDelete']
  /**
   * Create a DIDSet transaction draft. Account defaults to the bound
   * account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly didSet: TransactionBuilderMethods<Signing>['didSet']
  /**
   * Return escrowed XRP to the sender. Account defaults to the bound
   * account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly escrowCancel: TransactionBuilderMethods<Signing>['escrowCancel']
  /**
   * Sequester XRP until the escrow process either finishes or is canceled.
   * Account defaults to the bound account. With a local wallet, call signAndSubmit to send and
   * await success.
   */
  readonly escrowCreate: TransactionBuilderMethods<Signing>['escrowCreate']
  /**
   * Deliver XRP from a held payment to the recipient. Account defaults to
   * the bound account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly escrowFinish: TransactionBuilderMethods<Signing>['escrowFinish']
  /**
   * The LoanBrokerCoverClawback transaction claws back the First-Loss
   * Capital from the Loan Broker. The transaction can only be submitted by
   * the Issuer of the Loan asset. Furthermore, the transaction can only
   * clawback funds up to the minimum cover required for the current loans.
   * Account defaults to the bound account. With a local wallet, call signAndSubmit to send and
   * await success.
   */
  readonly loanBrokerCoverClawback: TransactionBuilderMethods<Signing>['loanBrokerCoverClawback']
  /**
   * The transaction deposits First Loss Capital into the LoanBroker object.
   * Account defaults to the bound account. With a local wallet, call signAndSubmit to send and
   * await success.
   */
  readonly loanBrokerCoverDeposit: TransactionBuilderMethods<Signing>['loanBrokerCoverDeposit']
  /**
   * The LoanBrokerCoverWithdraw transaction withdraws the First-Loss
   * Capital from the LoanBroker. Account defaults to the bound account.
   * With a local wallet, call signAndSubmit to send and await success.
   */
  readonly loanBrokerCoverWithdraw: TransactionBuilderMethods<Signing>['loanBrokerCoverWithdraw']
  /**
   * The transaction deletes LoanBroker ledger object. Account defaults to
   * the bound account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly loanBrokerDelete: TransactionBuilderMethods<Signing>['loanBrokerDelete']
  /**
   * The transaction creates a new LoanBroker object or updates an existing
   * one. Account defaults to the bound account. With a local wallet, call signAndSubmit to send
   * and await success.
   */
  readonly loanBrokerSet: TransactionBuilderMethods<Signing>['loanBrokerSet']
  /**
   * The transaction deletes an existing Loan object. Account defaults to
   * the bound account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly loanDelete: TransactionBuilderMethods<Signing>['loanDelete']
  /**
   * The transaction modifies an existing Loan object. Account defaults to
   * the bound account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly loanManage: TransactionBuilderMethods<Signing>['loanManage']
  /**
   * The Borrower submits a LoanPay transaction to make a Payment on the
   * Loan. Account defaults to the bound account. With a local wallet, call signAndSubmit to send
   * and await success.
   */
  readonly loanPay: TransactionBuilderMethods<Signing>['loanPay']
  /**
   * The transaction creates a new Loan object. Account defaults to the
   * bound account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly loanSet: TransactionBuilderMethods<Signing>['loanSet']
  /**
   * The MPTokenAuthorize transaction is used to globally lock/unlock a
   * MPTokenIssuance, or lock/unlock an individual's MPToken. Account
   * defaults to the bound account. With a local wallet, call signAndSubmit to send and await
   * success.
   */
  readonly mpTokenAuthorize: TransactionBuilderMethods<Signing>['mpTokenAuthorize']
  /**
   * The MPTokenIssuanceCreate transaction creates a MPTokenIssuance object
   * and adds it to the relevant directory node of the creator account. This
   * transaction is the only opportunity an issuer has to specify any token
   * fields that are defined as immutable (e.g., MPT Flags). If the
   * transaction is successful, the newly created token will be owned by the
   * account (the creator account) which executed the transaction. Account
   * defaults to the bound account. With a local wallet, call signAndSubmit to send and await
   * success.
   */
  readonly mpTokenIssuanceCreate: TransactionBuilderMethods<Signing>['mpTokenIssuanceCreate']
  /**
   * The MPTokenIssuanceDestroy transaction is used to remove an
   * MPTokenIssuance object from the directory node in which it is being
   * held, effectively removing the token from the ledger. If this operation
   * succeeds, the corresponding MPTokenIssuance is removed and the owner’s
   * reserve requirement is reduced by one. This operation must fail if
   * there are any holders who have non-zero balances. Account defaults to
   * the bound account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly mpTokenIssuanceDestroy: TransactionBuilderMethods<Signing>['mpTokenIssuanceDestroy']
  /**
   * The MPTokenIssuanceSet transaction is used to globally lock/unlock a
   * MPTokenIssuance, or lock/unlock an individual's MPToken. Account
   * defaults to the bound account. With a local wallet, call signAndSubmit to send and await
   * success.
   */
  readonly mpTokenIssuanceSet: TransactionBuilderMethods<Signing>['mpTokenIssuanceSet']
  /**
   * The NFTokenOfferAccept transaction is used to accept offers to buy or
   * sell an NFToken. It can either: Account defaults to the bound account.
   * With a local wallet, call signAndSubmit to send and await success.
   */
  readonly nfTokenAcceptOffer: TransactionBuilderMethods<Signing>['nfTokenAcceptOffer']
  /**
   * The NFTokenBurn transaction is used to remove an NFToken object from
   * the NFTokenPage in which it is being held, effectively removing the
   * token from the ledger ("burning" it). Account defaults to the bound
   * account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly nfTokenBurn: TransactionBuilderMethods<Signing>['nfTokenBurn']
  /**
   * The NFTokenCancelOffer transaction deletes existing NFTokenOffer
   * objects. It is useful if you want to free up space on your account to
   * lower your reserve requirement. Account defaults to the bound account.
   * With a local wallet, call signAndSubmit to send and await success.
   */
  readonly nfTokenCancelOffer: TransactionBuilderMethods<Signing>['nfTokenCancelOffer']
  /**
   * The NFTokenCreateOffer transaction creates either an offer to buy an
   * NFT the submitting account does not own, or an offer to sell an NFT the
   * submitting account does own. Account defaults to the bound account.
   * With a local wallet, call signAndSubmit to send and await success.
   */
  readonly nfTokenCreateOffer: TransactionBuilderMethods<Signing>['nfTokenCreateOffer']
  /**
   * The NFTokenMint transaction creates an NFToken object and adds it to
   * the relevant NFTokenPage object of the minter. If the transaction is
   * successful, the newly minted token will be owned by the minter account
   * specified by the transaction. Account defaults to the bound account.
   * With a local wallet, call signAndSubmit to send and await success.
   */
  readonly nfTokenMint: TransactionBuilderMethods<Signing>['nfTokenMint']
  /**
   * The NFTokenModify transaction modifies an NFToken's URI if its
   * tfMutable is set to true. Account defaults to the bound account. With a local wallet, call
   * signAndSubmit to send and await success.
   */
  readonly nfTokenModify: TransactionBuilderMethods<Signing>['nfTokenModify']
  /**
   * An OfferCancel transaction removes an Offer object from the XRP Ledger.
   * Account defaults to the bound account. With a local wallet, call signAndSubmit to send and
   * await success.
   */
  readonly offerCancel: TransactionBuilderMethods<Signing>['offerCancel']
  /**
   * An OfferCreate transaction is effectively a limit order . It defines an
   * intent to exchange currencies, and creates an Offer object if not
   * completely. Fulfilled when placed. Offers can be partially fulfilled.
   * Account defaults to the bound account. With a local wallet, call signAndSubmit to send and
   * await success.
   */
  readonly offerCreate: TransactionBuilderMethods<Signing>['offerCreate']
  /**
   * Delete an Oracle ledger entry. Account defaults to the bound account.
   * With a local wallet, call signAndSubmit to send and await success.
   */
  readonly oracleDelete: TransactionBuilderMethods<Signing>['oracleDelete']
  /**
   * Creates a new Oracle ledger entry or updates the fields of an existing
   * one, using the Oracle ID. Account defaults to the bound account. With a local wallet, call
   * signAndSubmit to send and await success.
   */
  readonly oracleSet: TransactionBuilderMethods<Signing>['oracleSet']
  /**
   * A Payment transaction represents a transfer of value from one account
   * to another. Account defaults to the bound account. With a local wallet, call signAndSubmit
   * to send and await success.
   */
  readonly payment: TransactionBuilderMethods<Signing>['payment']
  /**
   * Claim XRP from a payment channel, adjust the payment channel's
   * expiration, or both. Account defaults to the bound account. With a local wallet, call
   * signAndSubmit to send and await success.
   */
  readonly paymentChannelClaim: TransactionBuilderMethods<Signing>['paymentChannelClaim']
  /**
   * Create a unidirectional channel and fund it with XRP. The address
   * sending this transaction becomes the "source address" of the payment
   * channel. Account defaults to the bound account. With a local wallet, call signAndSubmit to
   * send and await success.
   */
  readonly paymentChannelCreate: TransactionBuilderMethods<Signing>['paymentChannelCreate']
  /**
   * Add additional XRP to an open payment channel, and optionally update
   * the expiration time of the channel. Only the source address of the
   * channel can use this transaction. Account defaults to the bound
   * account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly paymentChannelFund: TransactionBuilderMethods<Signing>['paymentChannelFund']
  /**
   * Create a PermissionedDomainDelete transaction draft. Account defaults
   * to the bound account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly permissionedDomainDelete: TransactionBuilderMethods<Signing>['permissionedDomainDelete']
  /**
   * Create a PermissionedDomainSet transaction draft. Account defaults to
   * the bound account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly permissionedDomainSet: TransactionBuilderMethods<Signing>['permissionedDomainSet']
  /**
   * A SetRegularKey transaction assigns, changes, or removes the regular
   * key pair associated with an account. Account defaults to the bound
   * account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly setRegularKey: TransactionBuilderMethods<Signing>['setRegularKey']
  /**
   * The SignerListSet transaction creates, replaces, or removes a list of
   * signers that can be used to multi-sign a transaction. Account defaults
   * to the bound account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly signerListSet: TransactionBuilderMethods<Signing>['signerListSet']
  /**
   * A SponsorshipSet transaction creates, modifies, or deletes a
   * Sponsorship object that defines a sponsorship relationship between two
   * accounts. Account defaults to the bound account. With a local wallet, call signAndSubmit to
   * send and await success.
   */
  readonly sponsorshipSet: TransactionBuilderMethods<Signing>['sponsorshipSet']
  /**
   * A SponsorshipTransfer transaction transfers ownership of a ledger
   * object's reserve sponsorship from one sponsor to another, creates a new
   * sponsorship, or removes sponsorship entirely. Account defaults to the
   * bound account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly sponsorshipTransfer: TransactionBuilderMethods<Signing>['sponsorshipTransfer']
  /**
   * A TicketCreate transaction sets aside one or more sequence numbers as
   * Tickets. Account defaults to the bound account. With a local wallet, call signAndSubmit to
   * send and await success.
   */
  readonly ticketCreate: TransactionBuilderMethods<Signing>['ticketCreate']
  /**
   * Create or modify a trust line linking two accounts. Account defaults to
   * the bound account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly trustSet: TransactionBuilderMethods<Signing>['trustSet']
  /**
   * The VaultClawback transaction performs a Clawback from the Vault,
   * exchanging the shares of an account. Account defaults to the bound
   * account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly vaultClawback: TransactionBuilderMethods<Signing>['vaultClawback']
  /**
   * The VaultCreate transaction creates a new Vault object. Account
   * defaults to the bound account. With a local wallet, call signAndSubmit to send and await
   * success.
   */
  readonly vaultCreate: TransactionBuilderMethods<Signing>['vaultCreate']
  /**
   * The VaultDelete transaction deletes an existing vault object. Account
   * defaults to the bound account. With a local wallet, call signAndSubmit to send and await
   * success.
   */
  readonly vaultDelete: TransactionBuilderMethods<Signing>['vaultDelete']
  /**
   * The VaultDeposit transaction adds liqudity in exchange for vault
   * shares. Account defaults to the bound account. With a local wallet, call signAndSubmit to
   * send and await success.
   */
  readonly vaultDeposit: TransactionBuilderMethods<Signing>['vaultDeposit']
  /**
   * The VaultSet transaction modifies mutable fields on an existing Vault
   * object. Account defaults to the bound account. With a local wallet, call signAndSubmit to
   * send and await success.
   */
  readonly vaultSet: TransactionBuilderMethods<Signing>['vaultSet']
  /**
   * The VaultWithdraw transaction withdraws assets in exchange for the
   * vault's shares. Account defaults to the bound account. With a local wallet, call
   * signAndSubmit to send and await success.
   */
  readonly vaultWithdraw: TransactionBuilderMethods<Signing>['vaultWithdraw']
  /**
   * The XChainAccountCreateCommit transaction creates a new account on one
   * of the chains a bridge connects, which serves as the bridge entrance
   * for that chain. Account defaults to the bound account. With a local wallet, call
   * signAndSubmit to send and await success.
   */
  readonly xChainAccountCreateCommit: TransactionBuilderMethods<Signing>['xChainAccountCreateCommit']
  /**
   * The XChainAddAccountCreateAttestation transaction provides an
   * attestation from a witness server that a {@link
   * XChainAccountCreateCommit } transaction occurred on the other chain.
   * Account defaults to the bound account. With a local wallet, call signAndSubmit to send and
   * await success.
   */
  readonly xChainAddAccountCreateAttestation: TransactionBuilderMethods<Signing>['xChainAddAccountCreateAttestation']
  /**
   * The XChainAddClaimAttestation transaction provides proof from a witness
   * server, attesting to an {@link XChainCommit } transaction. Account
   * defaults to the bound account. With a local wallet, call signAndSubmit to send and await
   * success.
   */
  readonly xChainAddClaimAttestation: TransactionBuilderMethods<Signing>['xChainAddClaimAttestation']
  /**
   * The XChainClaim transaction completes a cross-chain transfer of value.
   * It allows a user to claim the value on the destination chain - the
   * equivalent of the value locked on the source chain. Account defaults to
   * the bound account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly xChainClaim: TransactionBuilderMethods<Signing>['xChainClaim']
  /**
   * The XChainCommit is the second step in a cross-chain transfer. It puts
   * assets into trust on the locking chain so that they can be wrapped on
   * the issuing chain, or burns wrapped assets on the issuing chain so that
   * they can be returned on the locking chain. Account defaults to the
   * bound account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly xChainCommit: TransactionBuilderMethods<Signing>['xChainCommit']
  /**
   * The XChainCreateBridge transaction creates a new {@link Bridge } ledger
   * object and defines a new cross-chain bridge entrance on the chain that
   * the transaction is submitted on. It includes information about door
   * accounts and assets for the bridge. Account defaults to the bound
   * account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly xChainCreateBridge: TransactionBuilderMethods<Signing>['xChainCreateBridge']
  /**
   * The XChainCreateClaimID transaction creates a new cross-chain claim ID
   * that is used for a cross-chain transfer. A cross-chain claim ID
   * represents one cross-chain transfer of value. Account defaults to the
   * bound account. With a local wallet, call signAndSubmit to send and await success.
   */
  readonly xChainCreateClaimID: TransactionBuilderMethods<Signing>['xChainCreateClaimID']
  /**
   * The XChainModifyBridge transaction allows bridge managers to modify the
   * parameters of the bridge. Account defaults to the bound account. With a local wallet, call
   * signAndSubmit to send and await success.
   */
  readonly xChainModifyBridge: TransactionBuilderMethods<Signing>['xChainModifyBridge']
}

export function createTransactionBuilders(
  client: Client,
  account: string,
): TransactionBuilders<false>
export function createTransactionBuilders(
  client: Client,
  account: string,
  wallet: Wallet,
): TransactionBuilders
/**
 * Bind every transaction factory to an account, optionally with a local signer.
 *
 * @param client - Connection used for preparation and submission.
 * @param account - Default transaction account.
 * @param wallet - Optional local wallet.
 * @returns Discoverable transaction drafts or signing builders.
 */
export function createTransactionBuilders(
  client: Client,
  account: string,
  wallet?: Wallet,
): TransactionBuilders<boolean> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Typed registry boundary.
  return Object.freeze(
    Object.fromEntries(
      Object.entries(transactionNames).map(([TransactionType, name]) => [
        name,
        (
          fields: Record<string, unknown>,
        ): TransactionDraft<SubmittableTransaction> => {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Factory supplies discriminator.
          const transaction = {
            ...fields,
            Account: fields.Account ?? account,
            TransactionType,
          } as SubmittableTransaction
          return wallet
            ? new TransactionBuilder(client, wallet, transaction)
            : new TransactionDraft(client, transaction)
        },
      ]),
    ),
  ) as unknown as TransactionBuilders<boolean>
}
