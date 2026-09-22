import { assert } from 'chai'

import type {
  FeatureAllResponse,
  FeatureInfo,
  FeatureOneResponse,
} from '../../src/models/methods/feature'

const MPT_V1 =
  '950AE2EA4654E47F04AA8739C0B214E242097E802FD372D24047A89AB1F5EC38'
const CLAWBACK =
  '56B241D7A43D40354D02A9DC4C8DF5C7A1F930D92A9035C4E12291B3CA3E1C2B'
const AMM = '8CC0774A3BF66D1D22E76BBDA8E8A232E6B6313834301B3B23E8601196AE6455'

/**
 * Response-shape checks for `feature`. Each amendment entry must expose the
 * admin-only voting fields rippled emits for amendments that are not yet
 * enabled, without a cast.
 */
describe('feature response shape', function () {
  const features: Record<string, FeatureInfo> = {
    [MPT_V1]: {
      enabled: false,
      name: 'MPTokensV1',
      supported: true,
      vetoed: true,
      count: 0,
      validations: 1,
      threshold: 1,
    },
    [CLAWBACK]: {
      enabled: false,
      name: 'Clawback',
      supported: true,
      vetoed: 'Obsolete',
    },
    [AMM]: {
      enabled: true,
      name: 'AMM',
      supported: true,
      majority: 700000000,
    },
  }

  it('feature (all) entries expose vetoed and vote counts', function () {
    const response: FeatureAllResponse = {
      id: 1,
      type: 'response',
      result: { features },
    }

    const obsolete = Object.values(response.result.features)
      .filter((feature) => feature.vetoed === 'Obsolete')
      .map((feature) => feature.name)
    assert.deepEqual(obsolete, ['Clawback'])

    const vetoedNotEnabled = Object.values(response.result.features)
      .filter((feature) => !feature.enabled && feature.vetoed === true)
      .map((feature) => feature.name)
    assert.deepEqual(vetoedNotEnabled, ['MPTokensV1'])

    const mpt = response.result.features[MPT_V1]
    assert.equal(mpt.count, 0)
    assert.equal(mpt.validations, 1)
    assert.equal(mpt.threshold, 1)
    assert.isUndefined(mpt.majority)

    // Enabled amendments (and public servers) omit the admin-only fields.
    const amm = response.result.features[AMM]
    assert.isUndefined(amm.vetoed)
    assert.equal(amm.majority, 700000000)
  })

  it('feature (one) entry exposes vetoed', function () {
    const response: FeatureOneResponse = {
      id: 2,
      type: 'response',
      result: { [CLAWBACK]: features[CLAWBACK] },
    }

    assert.equal(response.result[CLAWBACK].vetoed, 'Obsolete')
    assert.equal(response.result[CLAWBACK].name, 'Clawback')
  })
})
