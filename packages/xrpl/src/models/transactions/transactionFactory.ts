import type { Transaction } from './transaction'

/**
 * The member of the {@link Transaction} union with a given `TransactionType` —
 * `TransactionOf<'MPTokenIssuanceCreate'>` is `MPTokenIssuanceCreate`.
 *
 * Useful for writing helpers over a transaction type named by a string, and
 * for annotating a variable whose type would otherwise be the whole union.
 *
 * @category Transaction Models
 */
export type TransactionOf<K extends Transaction['TransactionType']> = Extract<
  Transaction,
  { TransactionType: K }
>

/**
 * Type a transaction literal as the matching member of the {@link Transaction}
 * union, without widening and without an assertion.
 *
 * A bare object literal widens its `TransactionType` to `string`, so it no
 * longer matches `Transaction` and cannot be passed to `autofill`, `submit` or
 * `validate`. The usual workarounds are an `as Payment` assertion — which
 * silences real field errors — or an explicit annotation, which requires
 * importing and naming the type. This checks the literal against the one union
 * member its `TransactionType` selects, so a misspelled or missing field is an
 * error here rather than a `temMALFORMED` from the network, and returns it at
 * that same narrow type.
 *
 * @example
 * ```ts
 * const payment = tx({
 *   TransactionType: 'Payment',
 *   Account: wallet.address,
 *   Destination: destination,
 *   Amount: { mpt_issuance_id: mptIssuanceID, value: '10' },
 * })
 * await client.submitAndWait(payment, { wallet })
 * ```
 *
 * @param transaction - The transaction literal.
 * @returns The same object, typed as the matching union member.
 * @category Utilities
 */
export function tx<T extends Transaction>(transaction: T): T {
  return transaction
}
