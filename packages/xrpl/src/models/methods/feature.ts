import { BaseRequest, BaseResponse } from './baseMethod'

export interface FeatureAllRequest extends BaseRequest {
  command: 'feature'

  feature?: never
}

export interface FeatureOneRequest extends BaseRequest {
  command: 'feature'

  feature: string
}

/**
 * The `feature` command returns information about amendments this server knows about, including whether they are enabled.
 * Returns an {@link FeatureResponse}.
 *
 * @category Requests
 */
export type FeatureRequest = FeatureAllRequest | FeatureOneRequest

/**
 * Information about a single amendment, as returned by the `feature` command.
 * The response maps each amendment ID to one of these objects.
 */
export interface FeatureInfo {
  /**
   * Whether this amendment is currently enabled in the latest ledger.
   */
  enabled: boolean

  /**
   * The human-readable name for this amendment, if known.
   */
  name: string

  /**
   * Whether the server knows how to apply this amendment. If this is false
   * and `enabled` is true, the server may be amendment blocked.
   */
  supported: boolean

  /**
   * (Admin only; omitted for enabled amendments) For most amendments, whether
   * the server has been instructed to vote against this amendment. For
   * amendments that are marked as obsolete in the server's source code, this
   * is the string `Obsolete` instead.
   */
  vetoed?: boolean | 'Obsolete'

  /**
   * (Admin only; omitted for enabled amendments) The number of trusted
   * validators currently voting in favor of this amendment.
   */
  count?: number

  /**
   * (Admin only; omitted for enabled amendments) The total number of trusted
   * validations counted in the most recent voting round.
   */
  validations?: number

  /**
   * (Admin only; omitted for enabled amendments) The number of votes needed
   * for this amendment to reach majority.
   */
  threshold?: number

  /**
   * (Omitted unless the amendment currently has majority support) The time, in
   * seconds since the Ripple Epoch, at which this amendment gained majority
   * support. The amendment becomes enabled two weeks after this time if it
   * keeps its majority.
   */
  majority?: number
}

export interface FeatureAllResponse extends BaseResponse {
  result: {
    features: Record<string, FeatureInfo>
  }
}

export interface FeatureOneResponse extends BaseResponse {
  result: Record<string, FeatureInfo>
}

/**
 * Response expected from an {@link FeatureRequest}.
 *
 * @category Responses
 */
export type FeatureResponse = FeatureAllResponse | FeatureOneResponse
