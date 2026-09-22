import { assert } from 'chai'

import { getBalanceChanges } from '../../src/utils'
import mptAuthorizeCreate from '../fixtures/utils/mptAuthorizeCreate.json'
import mptAuthorizeDelete from '../fixtures/utils/mptAuthorizeDelete.json'
import mptClawback from '../fixtures/utils/mptClawback.json'
import mptClawbackFullBalance from '../fixtures/utils/mptClawbackFullBalance.json'
import mptIssuanceCreate from '../fixtures/utils/mptIssuanceCreate.json'
import mptIssuanceSetLockHolder from '../fixtures/utils/mptIssuanceSetLockHolder.json'
import mptPaymentHolderToHolder from '../fixtures/utils/mptPaymentHolderToHolder.json'
import mptPaymentHolderToIssuer from '../fixtures/utils/mptPaymentHolderToIssuer.json'
import mptPaymentIssuerToHolder from '../fixtures/utils/mptPaymentIssuerToHolder.json'
import paymentToken from '../fixtures/utils/paymentToken.json'
import paymentTokenDestinationNoBalance from '../fixtures/utils/paymentTokenDestinationNoBalance.json'
import paymentTokenMultipath from '../fixtures/utils/paymentTokenMultipath.json'
import paymentTokenRedeem from '../fixtures/utils/paymentTokenRedeem.json'
import paymentTokenRedeemThenIssue from '../fixtures/utils/paymentTokenRedeemThenIssue.json'
import paymentTokenSpendFullBalance from '../fixtures/utils/paymentTokenSpendFullBalance.json'
import paymentXrpCreateAccount from '../fixtures/utils/paymentXrpCreateAccount.json'
import trustlineCreate from '../fixtures/utils/trustlineCreate.json'
import trustlineDelete from '../fixtures/utils/trustlineDelete.json'
import trustlineSetLimit from '../fixtures/utils/trustlineSetLimit.json'
import trustlineSetLimit2 from '../fixtures/utils/trustlineSetLimit2.json'
import trustlineSetLimitZero from '../fixtures/utils/trustlineSetLimitZero.json'

describe('getBalanceChanges', function () {
  it('XRP create account', function () {
    const result = getBalanceChanges(paymentXrpCreateAccount.metadata)
    const expected = [
      {
        account: 'rLDYrujdKUfVx28T9vRDAbyJ7G2WVXKo4K',
        balances: [{ currency: 'XRP', value: '100' }],
      },
      {
        account: 'rKmBGxocj9Abgy25J51Mk1iqFzW9aVF9Tc',
        balances: [{ currency: 'XRP', value: '-100.012' }],
      },
    ]
    assert.deepStrictEqual(result, expected)
  })

  it('USD payment to account with no USD', function () {
    const result = getBalanceChanges(paymentTokenDestinationNoBalance.metadata)
    const expected = [
      {
        account: 'rKmBGxocj9Abgy25J51Mk1iqFzW9aVF9Tc',
        balances: [
          {
            value: '-0.01',
            currency: 'USD',
            issuer: 'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q',
          },
          {
            value: '-0.012',
            currency: 'XRP',
          },
        ],
      },
      {
        account: 'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q',
        balances: [
          {
            issuer: 'rKmBGxocj9Abgy25J51Mk1iqFzW9aVF9Tc',
            currency: 'USD',
            value: '0.01',
          },
          {
            issuer: 'rLDYrujdKUfVx28T9vRDAbyJ7G2WVXKo4K',
            currency: 'USD',
            value: '-0.01',
          },
        ],
      },
      {
        account: 'rLDYrujdKUfVx28T9vRDAbyJ7G2WVXKo4K',
        balances: [
          {
            issuer: 'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q',
            currency: 'USD',
            value: '0.01',
          },
        ],
      },
    ]
    assert.deepStrictEqual(result, expected)
  })

  it('USD payment of all USD in source account', function () {
    const result = getBalanceChanges(paymentTokenSpendFullBalance.metadata)
    const expected = [
      {
        account: 'rKmBGxocj9Abgy25J51Mk1iqFzW9aVF9Tc',
        balances: [
          {
            value: '0.2',
            currency: 'USD',
            issuer: 'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q',
          },
        ],
      },
      {
        account: 'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q',
        balances: [
          {
            value: '-0.2',
            currency: 'USD',
            issuer: 'rKmBGxocj9Abgy25J51Mk1iqFzW9aVF9Tc',
          },
          {
            value: '0.2',
            currency: 'USD',
            issuer: 'rLDYrujdKUfVx28T9vRDAbyJ7G2WVXKo4K',
          },
        ],
      },
      {
        account: 'rLDYrujdKUfVx28T9vRDAbyJ7G2WVXKo4K',
        balances: [
          {
            value: '-0.2',
            currency: 'USD',
            issuer: 'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q',
          },
          {
            value: '-0.012',
            currency: 'XRP',
          },
        ],
      },
    ]

    assert.deepStrictEqual(result, expected)
  })

  it('USD payment to account with USD', function () {
    const result = getBalanceChanges(paymentToken.metadata)
    const expected = [
      {
        account: 'rKmBGxocj9Abgy25J51Mk1iqFzW9aVF9Tc',
        balances: [
          {
            value: '-0.01',
            currency: 'USD',
            issuer: 'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q',
          },
          {
            value: '-0.012',
            currency: 'XRP',
          },
        ],
      },
      {
        account: 'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q',
        balances: [
          {
            issuer: 'rKmBGxocj9Abgy25J51Mk1iqFzW9aVF9Tc',
            currency: 'USD',
            value: '0.01',
          },
          {
            issuer: 'rLDYrujdKUfVx28T9vRDAbyJ7G2WVXKo4K',
            currency: 'USD',
            value: '-0.01',
          },
        ],
      },
      {
        account: 'rLDYrujdKUfVx28T9vRDAbyJ7G2WVXKo4K',
        balances: [
          {
            issuer: 'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q',
            currency: 'USD',
            value: '0.01',
          },
        ],
      },
    ]
    assert.deepStrictEqual(result, expected)
  })

  it('Set trust limit to 0 with balance remaining', function () {
    const result = getBalanceChanges(trustlineSetLimitZero.metadata)
    const expected = [
      {
        account: 'rLDYrujdKUfVx28T9vRDAbyJ7G2WVXKo4K',
        balances: [
          {
            value: '-0.012',
            currency: 'XRP',
          },
        ],
      },
    ]
    assert.deepStrictEqual(result, expected)
  })

  it('Create trustline', function () {
    const result = getBalanceChanges(trustlineCreate.metadata)
    const expected = [
      {
        account: 'rLDYrujdKUfVx28T9vRDAbyJ7G2WVXKo4K',
        balances: [
          {
            issuer: 'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q',
            currency: 'USD',
            value: '10',
          },
          {
            currency: 'XRP',
            value: '-0.012',
          },
        ],
      },
      {
        account: 'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q',
        balances: [
          {
            issuer: 'rLDYrujdKUfVx28T9vRDAbyJ7G2WVXKo4K',
            currency: 'USD',
            value: '-10',
          },
        ],
      },
    ]
    assert.deepStrictEqual(result, expected)
  })

  it('Set trustline', function () {
    const result = getBalanceChanges(trustlineSetLimit.metadata)
    const expected = [
      {
        account: 'rLDYrujdKUfVx28T9vRDAbyJ7G2WVXKo4K',
        balances: [
          {
            value: '-0.012',
            currency: 'XRP',
          },
        ],
      },
    ]
    assert.deepStrictEqual(result, expected)
  })

  it('Set trustline 2', function () {
    const result = getBalanceChanges(trustlineSetLimit2.metadata)
    const expected = [
      {
        account: 'rsApBGKJmMfExxZBrGnzxEXyq7TMhMRg4e',
        balances: [
          {
            currency: 'XRP',
            value: '-0.00001',
          },
        ],
      },
    ]
    assert.deepStrictEqual(result, expected)
  })

  it('Delete trustline', function () {
    const result = getBalanceChanges(trustlineDelete.metadata)
    const expected = [
      {
        account: 'rKmBGxocj9Abgy25J51Mk1iqFzW9aVF9Tc',
        balances: [
          {
            value: '0.02',
            currency: 'USD',
            issuer: 'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q',
          },
        ],
      },
      {
        account: 'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q',
        balances: [
          {
            value: '-0.02',
            currency: 'USD',
            issuer: 'rKmBGxocj9Abgy25J51Mk1iqFzW9aVF9Tc',
          },
          {
            value: '0.02',
            currency: 'USD',
            issuer: 'rLDYrujdKUfVx28T9vRDAbyJ7G2WVXKo4K',
          },
        ],
      },
      {
        account: 'rLDYrujdKUfVx28T9vRDAbyJ7G2WVXKo4K',
        balances: [
          {
            value: '-0.02',
            currency: 'USD',
            issuer: 'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q',
          },
          {
            value: '-0.012',
            currency: 'XRP',
          },
        ],
      },
    ]
    assert.deepStrictEqual(result, expected)
  })

  it('Redeem USD', function () {
    const result = getBalanceChanges(paymentTokenRedeem.result.meta)
    const expected = [
      {
        account: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
        balances: [
          {
            currency: 'USD',
            issuer: 'rPMh7Pi9ct699iZUTWaytJUoHcJ7cgyziK',
            value: '100',
          },
        ],
      },
      {
        account: 'rPMh7Pi9ct699iZUTWaytJUoHcJ7cgyziK',
        balances: [
          {
            currency: 'USD',
            issuer: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
            value: '-100',
          },
          {
            currency: 'XRP',
            value: '-0.00001',
          },
        ],
      },
    ]
    assert.deepStrictEqual(result, expected)
  })

  it('Redeem then issue USD', function () {
    const result = getBalanceChanges(paymentTokenRedeemThenIssue.result.meta)
    const expected = [
      {
        account: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
        balances: [
          {
            currency: 'USD',
            issuer: 'rPMh7Pi9ct699iZUTWaytJUoHcJ7cgyziK',
            value: '200',
          },
        ],
      },
      {
        account: 'rPMh7Pi9ct699iZUTWaytJUoHcJ7cgyziK',
        balances: [
          {
            currency: 'USD',
            issuer: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
            value: '-200',
          },
          {
            currency: 'XRP',
            value: '-0.00001',
          },
        ],
      },
    ]
    assert.deepStrictEqual(result, expected)
  })

  it('Multipath USD payment', function () {
    const result = getBalanceChanges(paymentTokenMultipath.result.meta)
    const expected = [
      {
        account: 'rrnsYgWn13Z28GtRgznrSUsLfMkvsXCZSu',
        balances: [
          {
            issuer: 'r4nmQNH4Fhjfh6cHDbvVSsBv7KySbj4cBf',
            currency: 'USD',
            value: '100',
          },
          {
            issuer: 'rnYDWQaRdMb5neCGgvFfhw3MBoxmv5LtfH',
            currency: 'USD',
            value: '-100',
          },
        ],
      },
      {
        account: 'r4nmQNH4Fhjfh6cHDbvVSsBv7KySbj4cBf',
        balances: [
          {
            issuer: 'rrnsYgWn13Z28GtRgznrSUsLfMkvsXCZSu',
            currency: 'USD',
            value: '-100',
          },
          {
            currency: 'XRP',
            value: '-0.00001',
          },
          {
            issuer: 'rJsaPnGdeo7BhMnHjuc3n44Mf7Ra1qkSVJ',
            currency: 'USD',
            value: '-100',
          },
          {
            issuer: 'rGpeQzUWFu4fMhJHZ1Via5aqFC3A5twZUD',
            currency: 'USD',
            value: '-100',
          },
        ],
      },
      {
        account: 'rJsaPnGdeo7BhMnHjuc3n44Mf7Ra1qkSVJ',
        balances: [
          {
            issuer: 'r4nmQNH4Fhjfh6cHDbvVSsBv7KySbj4cBf',
            currency: 'USD',
            value: '100',
          },
          {
            issuer: 'rnYDWQaRdMb5neCGgvFfhw3MBoxmv5LtfH',
            currency: 'USD',
            value: '-100',
          },
        ],
      },
      {
        account: 'rGpeQzUWFu4fMhJHZ1Via5aqFC3A5twZUD',
        balances: [
          {
            issuer: 'r4nmQNH4Fhjfh6cHDbvVSsBv7KySbj4cBf',
            currency: 'USD',
            value: '100',
          },
          {
            issuer: 'rnYDWQaRdMb5neCGgvFfhw3MBoxmv5LtfH',
            currency: 'USD',
            value: '-100',
          },
        ],
      },
      {
        account: 'rnYDWQaRdMb5neCGgvFfhw3MBoxmv5LtfH',
        balances: [
          {
            issuer: 'rJsaPnGdeo7BhMnHjuc3n44Mf7Ra1qkSVJ',
            currency: 'USD',
            value: '100',
          },
          {
            issuer: 'rrnsYgWn13Z28GtRgznrSUsLfMkvsXCZSu',
            currency: 'USD',
            value: '100',
          },
          {
            issuer: 'rGpeQzUWFu4fMhJHZ1Via5aqFC3A5twZUD',
            currency: 'USD',
            value: '100',
          },
        ],
      },
    ]
    assert.deepStrictEqual(result, expected)
  })

  describe('MPT', function () {
    const issuer = 'rPwRoK1JBVdHuJcfuch8u7kkysS9GHNS4B'
    const holder = 'r327rgjyTDWxvoyS7u89Uwk8KnDmqemLxi'
    const holder2 = 'rNB82s1SDgtEFfP1R4VdJQwhtehQp2C3Sm'
    const mptIssuanceId = '00000003F31B3639EF0D2EB4647C7722C5E92519042CC9B2'
    const fee = { currency: 'XRP', value: '-0.00024' }

    function mpt(value: string): {
      mpt_issuance_id: string
      currency: string
      value: string
    } {
      return { mpt_issuance_id: mptIssuanceId, currency: 'MPT', value }
    }

    it('MPTokenIssuanceCreate only pays the fee', function () {
      const result = getBalanceChanges(mptIssuanceCreate.metadata)
      assert.deepStrictEqual(result, [{ account: issuer, balances: [fee] }])
    })

    it('MPTokenAuthorize creating an empty MPToken only pays the fee', function () {
      const result = getBalanceChanges(mptAuthorizeCreate.metadata)
      assert.deepStrictEqual(result, [{ account: holder, balances: [fee] }])
    })

    it('MPT payment from the issuer to a holder with no MPTAmount yet', function () {
      // The holder's MPToken existed with no `MPTAmount` (zero), so the
      // ModifiedNode carries an empty `PreviousFields`.
      const result = getBalanceChanges(mptPaymentIssuerToHolder.metadata)
      const expected = [
        { account: issuer, balances: [mpt('-100'), fee] },
        { account: holder, balances: [mpt('100')] },
      ]
      assert.deepStrictEqual(result, expected)
    })

    it('MPT payment between two holders has no issuer row', function () {
      const result = getBalanceChanges(mptPaymentHolderToHolder.metadata)
      const expected = [
        { account: holder, balances: [fee, mpt('-10')] },
        { account: holder2, balances: [mpt('10')] },
      ]
      assert.deepStrictEqual(result, expected)
    })

    it('MPT payment from a holder back to the issuer', function () {
      const result = getBalanceChanges(mptPaymentHolderToIssuer.metadata)
      const expected = [
        { account: issuer, balances: [mpt('10')] },
        { account: holder, balances: [fee, mpt('-10')] },
      ]
      assert.deepStrictEqual(result, expected)
    })

    it('MPT clawback', function () {
      const result = getBalanceChanges(mptClawback.metadata)
      const expected = [
        { account: issuer, balances: [mpt('5'), fee] },
        { account: holder, balances: [mpt('-5')] },
      ]
      assert.deepStrictEqual(result, expected)
    })

    it('MPT clawback of the full balance drops MPTAmount from FinalFields', function () {
      const result = getBalanceChanges(mptClawbackFullBalance.metadata)
      const expected = [
        { account: issuer, balances: [mpt('10'), fee] },
        { account: holder2, balances: [mpt('-10')] },
      ]
      assert.deepStrictEqual(result, expected)
    })

    it('MPTokenIssuanceSet locking a holder with a balance changes nothing', function () {
      const result = getBalanceChanges(mptIssuanceSetLockHolder.metadata)
      assert.deepStrictEqual(result, [{ account: issuer, balances: [fee] }])
    })

    it('MPTokenAuthorize deleting an empty MPToken only pays the fee', function () {
      const result = getBalanceChanges(mptAuthorizeDelete.metadata)
      assert.deepStrictEqual(result, [{ account: holder2, balances: [fee] }])
    })
  })
})
