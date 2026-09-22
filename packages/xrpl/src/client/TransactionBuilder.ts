import type { SuccessfulTxResponse, SubmitResult } from '../models/methods'
import type {
  StrictTransaction,
  SubmittableTransaction,
} from '../models/transactions'
import type { Wallet } from '../Wallet'

import { transactionNames } from './registries'

import type { Client } from '.'

type InputKeys<T> = T extends unknown ? keyof T : never

type Model<Name extends SubmittableTransaction['TransactionType']> = Extract<
  SubmittableTransaction,
  { TransactionType: Name }
>

/** Fields for a wallet-bound draft. Account defaults to the signing wallet. */
export type TransactionInput<T extends SubmittableTransaction> =
  T extends unknown
    ? Omit<T, 'Account' | 'TransactionType'> & { Account?: T['Account'] }
    : never

/** A draft that sends nothing until signAndSubmit or trySignAndSubmit is called. */
export class TransactionBuilder<T extends SubmittableTransaction> {
  private readonly draft: T

  /**
   * Capture a draft independently of the caller's mutable input.
   *
   * @param client - Client used to prepare and submit the transaction.
   * @param wallet - Signing wallet.
   * @param transaction - Complete transaction draft.
   */
  public constructor(
    private readonly client: Client,
    private readonly wallet: Wallet,
    transaction: T,
  ) {
    this.draft = structuredClone(transaction)
  }

  /**
   * Inspect a copy of the draft without signing or sending it.
   *
   * @returns A copy including the defaulted account and selected type.
   */
  public toJSON(): T {
    return structuredClone(this.draft)
  }

  /**
   * Prepare, sign and submit the draft, then wait for validated success.
   *
   * @returns The successful transaction response.
   * @throws Error if signing, submission or the transaction fails.
   */
  public async signAndSubmit(): Promise<SuccessfulTxResponse<T>> {
    // T is the model selected by the registry; fields were checked when the draft was created.
    return this.client.submitAndWait(this.toJSON() as StrictTransaction<T>, {
      wallet: this.wallet,
    })
  }

  /**
   * Prepare, sign and submit, returning an explicit success/error result.
   *
   * @returns A result to handle through its ok discriminant.
   */
  public async trySignAndSubmit(): Promise<SubmitResult<T>> {
    return this.client.trySubmitAndWait(this.toJSON() as StrictTransaction<T>, {
      wallet: this.wallet,
    })
  }
}

/** All user-submittable transactions, excluding validator pseudo-transactions. */
type TransactionBuilderMethods = {
  readonly [Name in keyof typeof transactionNames as (typeof transactionNames)[Name]]: <
    const F extends TransactionInput<Model<Name>>,
  >(
    fields: F & {
      [K in Exclude<keyof F, InputKeys<TransactionInput<Model<Name>>>>]?: never
    },
  ) => TransactionBuilder<Model<Name>>
}

/** Documented methods whose signatures follow the mapped models. */
export interface TransactionBuilders extends TransactionBuilderMethods {
  /**
   * An AccountDelete transaction deletes an account and any objects it owns
   * in the XRP Ledger, if possible, sending the account's remaining XRP to
   * a specified destination account. Account defaults to the client wallet.
   * Call signAndSubmit to send and await success.
   */
  readonly accountDelete: TransactionBuilderMethods['accountDelete']
  /**
   * An AccountSet transaction modifies the properties of an account in the
   * XRP Ledger. Account defaults to the client wallet. Call signAndSubmit
   * to send and await success.
   */
  readonly accountSet: TransactionBuilderMethods['accountSet']
  /**
   * Bid on an Automated Market Maker's (AMM's) auction slot. Account
   * defaults to the client wallet. Call signAndSubmit to send and await
   * success.
   */
  readonly ammBid: TransactionBuilderMethods['ammBid']
  /**
   * Claw back tokens from a holder that has deposited your issued tokens
   * into an AMM pool. Account defaults to the client wallet. Call
   * signAndSubmit to send and await success.
   */
  readonly ammClawback: TransactionBuilderMethods['ammClawback']
  /**
   * Create a new Automated Market Maker (AMM) instance for trading a pair
   * of assets (fungible tokens or XRP). Account defaults to the client
   * wallet. Call signAndSubmit to send and await success.
   */
  readonly ammCreate: TransactionBuilderMethods['ammCreate']
  /**
   * Delete an empty Automated Market Maker (AMM) instance that could not be
   * fully deleted automatically. Account defaults to the client wallet.
   * Call signAndSubmit to send and await success.
   */
  readonly ammDelete: TransactionBuilderMethods['ammDelete']
  /**
   * Deposit funds into an Automated Market Maker (AMM) instance and receive
   * the AMM's liquidity provider tokens (LP Tokens) in exchange. Account
   * defaults to the client wallet. Call signAndSubmit to send and await
   * success.
   */
  readonly ammDeposit: TransactionBuilderMethods['ammDeposit']
  /**
   * Vote on the trading fee for an Automated Market Maker (AMM) instance.
   * Account defaults to the client wallet. Call signAndSubmit to send and
   * await success.
   */
  readonly ammVote: TransactionBuilderMethods['ammVote']
  /**
   * Withdraw assets from an Automated Market Maker (AMM) instance by
   * returning the AMM's liquidity provider tokens (LP Tokens). Account
   * defaults to the client wallet. Call signAndSubmit to send and await
   * success.
   */
  readonly ammWithdraw: TransactionBuilderMethods['ammWithdraw']
  /**
   * Create a Batch transaction draft. Account defaults to the client
   * wallet. Call signAndSubmit to send and await success.
   */
  readonly batch: TransactionBuilderMethods['batch']
  /**
   * Cancels an unredeemed Check, removing it from the ledger without
   * sending any money. The source or the destination of the check can
   * cancel a Check at any time using this transaction type. If the Check
   * has expired, any address can cancel it. Account defaults to the client
   * wallet. Call signAndSubmit to send and await success.
   */
  readonly checkCancel: TransactionBuilderMethods['checkCancel']
  /**
   * Attempts to redeem a Check object in the ledger to receive up to the
   * amount authorized by the corresponding CheckCreate transaction. Only
   * the Destination address of a Check can cash it with a CheckCash
   * transaction. Account defaults to the client wallet. Call signAndSubmit
   * to send and await success.
   */
  readonly checkCash: TransactionBuilderMethods['checkCash']
  /**
   * Create a Check object in the ledger, which is a deferred payment that
   * can be cashed by its intended destination. The sender of this
   * transaction is the sender of the Check. Account defaults to the client
   * wallet. Call signAndSubmit to send and await success.
   */
  readonly checkCreate: TransactionBuilderMethods['checkCreate']
  /**
   * The Clawback transaction is used by the token issuer to claw back
   * issued tokens from a holder. Account defaults to the client wallet.
   * Call signAndSubmit to send and await success.
   */
  readonly clawback: TransactionBuilderMethods['clawback']
  /**
   * The ConfidentialMPTClawback transaction lets an issuer claw back a
   * confidential MPT amount from a holder's confidential balance. Account
   * defaults to the client wallet. Call signAndSubmit to send and await
   * success.
   */
  readonly confidentialMPTClawback: TransactionBuilderMethods['confidentialMPTClawback']
  /**
   * The ConfidentialMPTConvert transaction moves a holder's public MPT
   * balance into their confidential (encrypted) balance. It is also used by
   * a holder to register their ElGamal encryption key for the issuance.
   * Account defaults to the client wallet. Call signAndSubmit to send and
   * await success.
   */
  readonly confidentialMPTConvert: TransactionBuilderMethods['confidentialMPTConvert']
  /**
   * The ConfidentialMPTConvertBack transaction moves a holder's
   * confidential (encrypted) balance back into their public MPT balance.
   * Account defaults to the client wallet. Call signAndSubmit to send and
   * await success.
   */
  readonly confidentialMPTConvertBack: TransactionBuilderMethods['confidentialMPTConvertBack']
  /**
   * The ConfidentialMPTMergeInbox transaction folds a holder's pending
   * confidential inbox balance into their spendable confidential balance.
   * Account defaults to the client wallet. Call signAndSubmit to send and
   * await success.
   */
  readonly confidentialMPTMergeInbox: TransactionBuilderMethods['confidentialMPTMergeInbox']
  /**
   * The ConfidentialMPTSend transaction transfers a confidential
   * (encrypted) MPT amount from the sender's confidential balance to a
   * destination's confidential inbox, without revealing the amount
   * on-ledger. Account defaults to the client wallet. Call signAndSubmit to
   * send and await success.
   */
  readonly confidentialMPTSend: TransactionBuilderMethods['confidentialMPTSend']
  /**
   * Accepts a credential issued to the Account (i.e. the Account is the
   * Subject of the Credential object). Credentials are represented in hex.
   * Whilst they are allowed a maximum length of 64 bytes, every byte
   * requires 2 hex characters for representation. The credential is not
   * considered valid until it has been transferred/accepted. Account
   * defaults to the client wallet. Call signAndSubmit to send and await
   * success.
   */
  readonly credentialAccept: TransactionBuilderMethods['credentialAccept']
  /**
   * Creates a Credential object. It must be sent by the issuer. Account
   * defaults to the client wallet. Call signAndSubmit to send and await
   * success.
   */
  readonly credentialCreate: TransactionBuilderMethods['credentialCreate']
  /**
   * Deletes a Credential object. Account defaults to the client wallet.
   * Call signAndSubmit to send and await success.
   */
  readonly credentialDelete: TransactionBuilderMethods['credentialDelete']
  /**
   * DelegateSet allows an account to delegate a set of permissions to
   * another account. Account defaults to the client wallet. Call
   * signAndSubmit to send and await success.
   */
  readonly delegateSet: TransactionBuilderMethods['delegateSet']
  /**
   * A DepositPreauth transaction gives another account pre-approval to
   * deliver payments to the sender of this transaction. This is only useful
   * if the sender of this transaction is using (or plans to use) Deposit
   * Authorization. Account defaults to the client wallet. Call
   * signAndSubmit to send and await success.
   */
  readonly depositPreauth: TransactionBuilderMethods['depositPreauth']
  /**
   * Create a DIDDelete transaction draft. Account defaults to the client
   * wallet. Call signAndSubmit to send and await success.
   */
  readonly didDelete: TransactionBuilderMethods['didDelete']
  /**
   * Create a DIDSet transaction draft. Account defaults to the client
   * wallet. Call signAndSubmit to send and await success.
   */
  readonly didSet: TransactionBuilderMethods['didSet']
  /**
   * Return escrowed XRP to the sender. Account defaults to the client
   * wallet. Call signAndSubmit to send and await success.
   */
  readonly escrowCancel: TransactionBuilderMethods['escrowCancel']
  /**
   * Sequester XRP until the escrow process either finishes or is canceled.
   * Account defaults to the client wallet. Call signAndSubmit to send and
   * await success.
   */
  readonly escrowCreate: TransactionBuilderMethods['escrowCreate']
  /**
   * Deliver XRP from a held payment to the recipient. Account defaults to
   * the client wallet. Call signAndSubmit to send and await success.
   */
  readonly escrowFinish: TransactionBuilderMethods['escrowFinish']
  /**
   * The LoanBrokerCoverClawback transaction claws back the First-Loss
   * Capital from the Loan Broker. The transaction can only be submitted by
   * the Issuer of the Loan asset. Furthermore, the transaction can only
   * clawback funds up to the minimum cover required for the current loans.
   * Account defaults to the client wallet. Call signAndSubmit to send and
   * await success.
   */
  readonly loanBrokerCoverClawback: TransactionBuilderMethods['loanBrokerCoverClawback']
  /**
   * The transaction deposits First Loss Capital into the LoanBroker object.
   * Account defaults to the client wallet. Call signAndSubmit to send and
   * await success.
   */
  readonly loanBrokerCoverDeposit: TransactionBuilderMethods['loanBrokerCoverDeposit']
  /**
   * The LoanBrokerCoverWithdraw transaction withdraws the First-Loss
   * Capital from the LoanBroker. Account defaults to the client wallet.
   * Call signAndSubmit to send and await success.
   */
  readonly loanBrokerCoverWithdraw: TransactionBuilderMethods['loanBrokerCoverWithdraw']
  /**
   * The transaction deletes LoanBroker ledger object. Account defaults to
   * the client wallet. Call signAndSubmit to send and await success.
   */
  readonly loanBrokerDelete: TransactionBuilderMethods['loanBrokerDelete']
  /**
   * The transaction creates a new LoanBroker object or updates an existing
   * one. Account defaults to the client wallet. Call signAndSubmit to send
   * and await success.
   */
  readonly loanBrokerSet: TransactionBuilderMethods['loanBrokerSet']
  /**
   * The transaction deletes an existing Loan object. Account defaults to
   * the client wallet. Call signAndSubmit to send and await success.
   */
  readonly loanDelete: TransactionBuilderMethods['loanDelete']
  /**
   * The transaction modifies an existing Loan object. Account defaults to
   * the client wallet. Call signAndSubmit to send and await success.
   */
  readonly loanManage: TransactionBuilderMethods['loanManage']
  /**
   * The Borrower submits a LoanPay transaction to make a Payment on the
   * Loan. Account defaults to the client wallet. Call signAndSubmit to send
   * and await success.
   */
  readonly loanPay: TransactionBuilderMethods['loanPay']
  /**
   * The transaction creates a new Loan object. Account defaults to the
   * client wallet. Call signAndSubmit to send and await success.
   */
  readonly loanSet: TransactionBuilderMethods['loanSet']
  /**
   * The MPTokenAuthorize transaction is used to globally lock/unlock a
   * MPTokenIssuance, or lock/unlock an individual's MPToken. Account
   * defaults to the client wallet. Call signAndSubmit to send and await
   * success.
   */
  readonly mpTokenAuthorize: TransactionBuilderMethods['mpTokenAuthorize']
  /**
   * The MPTokenIssuanceCreate transaction creates a MPTokenIssuance object
   * and adds it to the relevant directory node of the creator account. This
   * transaction is the only opportunity an issuer has to specify any token
   * fields that are defined as immutable (e.g., MPT Flags). If the
   * transaction is successful, the newly created token will be owned by the
   * account (the creator account) which executed the transaction. Account
   * defaults to the client wallet. Call signAndSubmit to send and await
   * success.
   */
  readonly mpTokenIssuanceCreate: TransactionBuilderMethods['mpTokenIssuanceCreate']
  /**
   * The MPTokenIssuanceDestroy transaction is used to remove an
   * MPTokenIssuance object from the directory node in which it is being
   * held, effectively removing the token from the ledger. If this operation
   * succeeds, the corresponding MPTokenIssuance is removed and the owner’s
   * reserve requirement is reduced by one. This operation must fail if
   * there are any holders who have non-zero balances. Account defaults to
   * the client wallet. Call signAndSubmit to send and await success.
   */
  readonly mpTokenIssuanceDestroy: TransactionBuilderMethods['mpTokenIssuanceDestroy']
  /**
   * The MPTokenIssuanceSet transaction is used to globally lock/unlock a
   * MPTokenIssuance, or lock/unlock an individual's MPToken. Account
   * defaults to the client wallet. Call signAndSubmit to send and await
   * success.
   */
  readonly mpTokenIssuanceSet: TransactionBuilderMethods['mpTokenIssuanceSet']
  /**
   * The NFTokenOfferAccept transaction is used to accept offers to buy or
   * sell an NFToken. It can either: Account defaults to the client wallet.
   * Call signAndSubmit to send and await success.
   */
  readonly nfTokenAcceptOffer: TransactionBuilderMethods['nfTokenAcceptOffer']
  /**
   * The NFTokenBurn transaction is used to remove an NFToken object from
   * the NFTokenPage in which it is being held, effectively removing the
   * token from the ledger ("burning" it). Account defaults to the client
   * wallet. Call signAndSubmit to send and await success.
   */
  readonly nfTokenBurn: TransactionBuilderMethods['nfTokenBurn']
  /**
   * The NFTokenCancelOffer transaction deletes existing NFTokenOffer
   * objects. It is useful if you want to free up space on your account to
   * lower your reserve requirement. Account defaults to the client wallet.
   * Call signAndSubmit to send and await success.
   */
  readonly nfTokenCancelOffer: TransactionBuilderMethods['nfTokenCancelOffer']
  /**
   * The NFTokenCreateOffer transaction creates either an offer to buy an
   * NFT the submitting account does not own, or an offer to sell an NFT the
   * submitting account does own. Account defaults to the client wallet.
   * Call signAndSubmit to send and await success.
   */
  readonly nfTokenCreateOffer: TransactionBuilderMethods['nfTokenCreateOffer']
  /**
   * The NFTokenMint transaction creates an NFToken object and adds it to
   * the relevant NFTokenPage object of the minter. If the transaction is
   * successful, the newly minted token will be owned by the minter account
   * specified by the transaction. Account defaults to the client wallet.
   * Call signAndSubmit to send and await success.
   */
  readonly nfTokenMint: TransactionBuilderMethods['nfTokenMint']
  /**
   * The NFTokenModify transaction modifies an NFToken's URI if its
   * tfMutable is set to true. Account defaults to the client wallet. Call
   * signAndSubmit to send and await success.
   */
  readonly nfTokenModify: TransactionBuilderMethods['nfTokenModify']
  /**
   * An OfferCancel transaction removes an Offer object from the XRP Ledger.
   * Account defaults to the client wallet. Call signAndSubmit to send and
   * await success.
   */
  readonly offerCancel: TransactionBuilderMethods['offerCancel']
  /**
   * An OfferCreate transaction is effectively a limit order . It defines an
   * intent to exchange currencies, and creates an Offer object if not
   * completely. Fulfilled when placed. Offers can be partially fulfilled.
   * Account defaults to the client wallet. Call signAndSubmit to send and
   * await success.
   */
  readonly offerCreate: TransactionBuilderMethods['offerCreate']
  /**
   * Delete an Oracle ledger entry. Account defaults to the client wallet.
   * Call signAndSubmit to send and await success.
   */
  readonly oracleDelete: TransactionBuilderMethods['oracleDelete']
  /**
   * Creates a new Oracle ledger entry or updates the fields of an existing
   * one, using the Oracle ID. Account defaults to the client wallet. Call
   * signAndSubmit to send and await success.
   */
  readonly oracleSet: TransactionBuilderMethods['oracleSet']
  /**
   * A Payment transaction represents a transfer of value from one account
   * to another. Account defaults to the client wallet. Call signAndSubmit
   * to send and await success.
   */
  readonly payment: TransactionBuilderMethods['payment']
  /**
   * Claim XRP from a payment channel, adjust the payment channel's
   * expiration, or both. Account defaults to the client wallet. Call
   * signAndSubmit to send and await success.
   */
  readonly paymentChannelClaim: TransactionBuilderMethods['paymentChannelClaim']
  /**
   * Create a unidirectional channel and fund it with XRP. The address
   * sending this transaction becomes the "source address" of the payment
   * channel. Account defaults to the client wallet. Call signAndSubmit to
   * send and await success.
   */
  readonly paymentChannelCreate: TransactionBuilderMethods['paymentChannelCreate']
  /**
   * Add additional XRP to an open payment channel, and optionally update
   * the expiration time of the channel. Only the source address of the
   * channel can use this transaction. Account defaults to the client
   * wallet. Call signAndSubmit to send and await success.
   */
  readonly paymentChannelFund: TransactionBuilderMethods['paymentChannelFund']
  /**
   * Create a PermissionedDomainDelete transaction draft. Account defaults
   * to the client wallet. Call signAndSubmit to send and await success.
   */
  readonly permissionedDomainDelete: TransactionBuilderMethods['permissionedDomainDelete']
  /**
   * Create a PermissionedDomainSet transaction draft. Account defaults to
   * the client wallet. Call signAndSubmit to send and await success.
   */
  readonly permissionedDomainSet: TransactionBuilderMethods['permissionedDomainSet']
  /**
   * A SetRegularKey transaction assigns, changes, or removes the regular
   * key pair associated with an account. Account defaults to the client
   * wallet. Call signAndSubmit to send and await success.
   */
  readonly setRegularKey: TransactionBuilderMethods['setRegularKey']
  /**
   * The SignerListSet transaction creates, replaces, or removes a list of
   * signers that can be used to multi-sign a transaction. Account defaults
   * to the client wallet. Call signAndSubmit to send and await success.
   */
  readonly signerListSet: TransactionBuilderMethods['signerListSet']
  /**
   * A SponsorshipSet transaction creates, modifies, or deletes a
   * Sponsorship object that defines a sponsorship relationship between two
   * accounts. Account defaults to the client wallet. Call signAndSubmit to
   * send and await success.
   */
  readonly sponsorshipSet: TransactionBuilderMethods['sponsorshipSet']
  /**
   * A SponsorshipTransfer transaction transfers ownership of a ledger
   * object's reserve sponsorship from one sponsor to another, creates a new
   * sponsorship, or removes sponsorship entirely. Account defaults to the
   * client wallet. Call signAndSubmit to send and await success.
   */
  readonly sponsorshipTransfer: TransactionBuilderMethods['sponsorshipTransfer']
  /**
   * A TicketCreate transaction sets aside one or more sequence numbers as
   * Tickets. Account defaults to the client wallet. Call signAndSubmit to
   * send and await success.
   */
  readonly ticketCreate: TransactionBuilderMethods['ticketCreate']
  /**
   * Create or modify a trust line linking two accounts. Account defaults to
   * the client wallet. Call signAndSubmit to send and await success.
   */
  readonly trustSet: TransactionBuilderMethods['trustSet']
  /**
   * The VaultClawback transaction performs a Clawback from the Vault,
   * exchanging the shares of an account. Account defaults to the client
   * wallet. Call signAndSubmit to send and await success.
   */
  readonly vaultClawback: TransactionBuilderMethods['vaultClawback']
  /**
   * The VaultCreate transaction creates a new Vault object. Account
   * defaults to the client wallet. Call signAndSubmit to send and await
   * success.
   */
  readonly vaultCreate: TransactionBuilderMethods['vaultCreate']
  /**
   * The VaultDelete transaction deletes an existing vault object. Account
   * defaults to the client wallet. Call signAndSubmit to send and await
   * success.
   */
  readonly vaultDelete: TransactionBuilderMethods['vaultDelete']
  /**
   * The VaultDeposit transaction adds liqudity in exchange for vault
   * shares. Account defaults to the client wallet. Call signAndSubmit to
   * send and await success.
   */
  readonly vaultDeposit: TransactionBuilderMethods['vaultDeposit']
  /**
   * The VaultSet transaction modifies mutable fields on an existing Vault
   * object. Account defaults to the client wallet. Call signAndSubmit to
   * send and await success.
   */
  readonly vaultSet: TransactionBuilderMethods['vaultSet']
  /**
   * The VaultWithdraw transaction withdraws assets in exchange for the
   * vault's shares. Account defaults to the client wallet. Call
   * signAndSubmit to send and await success.
   */
  readonly vaultWithdraw: TransactionBuilderMethods['vaultWithdraw']
  /**
   * The XChainAccountCreateCommit transaction creates a new account on one
   * of the chains a bridge connects, which serves as the bridge entrance
   * for that chain. Account defaults to the client wallet. Call
   * signAndSubmit to send and await success.
   */
  readonly xChainAccountCreateCommit: TransactionBuilderMethods['xChainAccountCreateCommit']
  /**
   * The XChainAddAccountCreateAttestation transaction provides an
   * attestation from a witness server that a {@link
   * XChainAccountCreateCommit } transaction occurred on the other chain.
   * Account defaults to the client wallet. Call signAndSubmit to send and
   * await success.
   */
  readonly xChainAddAccountCreateAttestation: TransactionBuilderMethods['xChainAddAccountCreateAttestation']
  /**
   * The XChainAddClaimAttestation transaction provides proof from a witness
   * server, attesting to an {@link XChainCommit } transaction. Account
   * defaults to the client wallet. Call signAndSubmit to send and await
   * success.
   */
  readonly xChainAddClaimAttestation: TransactionBuilderMethods['xChainAddClaimAttestation']
  /**
   * The XChainClaim transaction completes a cross-chain transfer of value.
   * It allows a user to claim the value on the destination chain - the
   * equivalent of the value locked on the source chain. Account defaults to
   * the client wallet. Call signAndSubmit to send and await success.
   */
  readonly xChainClaim: TransactionBuilderMethods['xChainClaim']
  /**
   * The XChainCommit is the second step in a cross-chain transfer. It puts
   * assets into trust on the locking chain so that they can be wrapped on
   * the issuing chain, or burns wrapped assets on the issuing chain so that
   * they can be returned on the locking chain. Account defaults to the
   * client wallet. Call signAndSubmit to send and await success.
   */
  readonly xChainCommit: TransactionBuilderMethods['xChainCommit']
  /**
   * The XChainCreateBridge transaction creates a new {@link Bridge } ledger
   * object and defines a new cross-chain bridge entrance on the chain that
   * the transaction is submitted on. It includes information about door
   * accounts and assets for the bridge. Account defaults to the client
   * wallet. Call signAndSubmit to send and await success.
   */
  readonly xChainCreateBridge: TransactionBuilderMethods['xChainCreateBridge']
  /**
   * The XChainCreateClaimID transaction creates a new cross-chain claim ID
   * that is used for a cross-chain transfer. A cross-chain claim ID
   * represents one cross-chain transfer of value. Account defaults to the
   * client wallet. Call signAndSubmit to send and await success.
   */
  readonly xChainCreateClaimID: TransactionBuilderMethods['xChainCreateClaimID']
  /**
   * The XChainModifyBridge transaction allows bridge managers to modify the
   * parameters of the bridge. Account defaults to the client wallet. Call
   * signAndSubmit to send and await success.
   */
  readonly xChainModifyBridge: TransactionBuilderMethods['xChainModifyBridge']
}

/**
 * Bind each transaction factory to its discriminator and signing wallet.
 *
 * @param client - Connection used for submission.
 * @param wallet - Default signing account.
 * @returns Discoverable transaction builders.
 */
export function createTransactionBuilders(
  client: Client,
  wallet: Wallet,
): TransactionBuilders {
  // This registry is exhaustive over SubmittableTransaction, with no dynamic fallback names.
  return Object.freeze(
    Object.fromEntries(
      Object.entries(transactionNames).map(([TransactionType, name]) => [
        name,
        (fields: Record<string, unknown>) =>
          new TransactionBuilder(client, wallet, {
            ...fields,
            Account: fields.Account ?? wallet.address,
            TransactionType,
          } as SubmittableTransaction),
      ]),
    ),
  ) as unknown as TransactionBuilders
}
