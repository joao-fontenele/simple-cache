import {
  Policy, SamplingBreaker, IBreaker, CircuitBreakerPolicy as CBPolicy,
} from 'cockatiel';
import { MyPolicy, PolicyLike } from './policy';
import { rtaEmitter, RTAEmitter } from '../rta-emitter';

/**
 * @typedef {Object} CircuitBreakerOptions
 * @property {?number} [threshold=0.3] - percentage [0, 1] of requests that need
 * to fail for the circuit breaker to open the circuit, during the sampling
 * `duration`.
 * @property {?number} [duration=30000] - sampling period (in milliseconds) for
 * the circuit to open, if the failed request cross the `threshold`.
 * @property {?number} [minimumRps=5] - don't open the circuit if there's less
 * than this amount of RPS. This avoids opening the circuit, during failures in
 * low load periods.
 * @property {?number} [halfOpenAfter=30000] - amount of time
 * @property {?string} name - name of the service on which the circuit is being
 * used.
 */

export interface CircuitBreakerOptions {
  threshold?: number | null,
  duration?: number | null,
  minimumRps?: number | null,
  halfOpenAfter?: number | null,
  name?: string | null,
}

/**
 * Creates and holds a circuit breaker policy.
 */
export class CircuitBreakerPolicy extends MyPolicy {
  defaultOptions: CircuitBreakerOptions = {
    threshold: 0.3,
    duration: 30 * 1000,
    minimumRps: 5,
    halfOpenAfter: 30000,
    name: '',
  };

  options: CircuitBreakerOptions;

  policy: PolicyLike;

  rta: RTAEmitter;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listeners: Array<any>;

  circuitBreaker: IBreaker;

  /**
   * @constructor
   * @param {CircuitBreakerOptions} options
   */
  constructor(options: CircuitBreakerOptions) {
    super();

    this.options = options;
    this.policy = Policy.noop;
    this.rta = rtaEmitter;
    this.listeners = [];
    this.circuitBreaker = null;

    if (typeof options === 'object') {
      const configuredOptions = { ...this.defaultOptions, ...options };
      const {
        name,
        halfOpenAfter,
        threshold,
        minimumRps,
        duration,
      } = configuredOptions;
      this.circuitBreaker = new SamplingBreaker({ threshold, minimumRps, duration });
      this.policy = Policy.handleAll()
        .circuitBreaker(halfOpenAfter, this.circuitBreaker);

      // TODO: can these listeners generate a memory leak?
      const onBreakListener = (this.policy as CBPolicy).onBreak(
        () => this.rta.emitCircuitStateChange(name, 'opened'),
      );
      const onResetListener = (this.policy as CBPolicy).onReset(
        () => this.rta.emitCircuitStateChange(name, 'closed'),
      );
      this.listeners.push(onBreakListener);
      this.listeners.push(onResetListener);
    }
  }
}
