import { DomainError } from './errors.js';

export const BOOKING_STATES = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  CHECKED_IN: 'checked_in',
});

export const ALL_STATES = Object.freeze(Object.values(BOOKING_STATES));

/**
 * Adjacency map defining valid state transitions.
 * Terminal states (cancelled, refunded, checked_in) have empty transition sets.
 */
export const ALLOWED_TRANSITIONS = Object.freeze({
  [BOOKING_STATES.PENDING]: Object.freeze([
    BOOKING_STATES.PAID,
    BOOKING_STATES.CANCELLED,
  ]),
  [BOOKING_STATES.PAID]: Object.freeze([
    BOOKING_STATES.CHECKED_IN,
    BOOKING_STATES.REFUNDED,
    BOOKING_STATES.CANCELLED,
  ]),
  [BOOKING_STATES.CANCELLED]: Object.freeze([]),
  [BOOKING_STATES.REFUNDED]: Object.freeze([]),
  [BOOKING_STATES.CHECKED_IN]: Object.freeze([]),
});

/**
 * Returns true if transitioning from `fromState` to `toState` is permitted.
 * Returns false for unknown states or illegal transitions.
 *
 * @param {string} fromState
 * @param {string} toState
 * @returns {boolean}
 */
export function canTransition(fromState, toState) {
  if (!Object.hasOwn(ALLOWED_TRANSITIONS, fromState)) {
    return false;
  }
  return ALLOWED_TRANSITIONS[fromState].includes(toState);
}

/**
 * Asserts that transitioning from `fromState` to `toState` is valid.
 * Throws DomainError with code 'INVALID_TRANSITION' if disallowed.
 *
 * @param {string} fromState
 * @param {string} toState
 */
export function assertTransition(fromState, toState) {
  if (!canTransition(fromState, toState)) {
    throw new DomainError(
      'INVALID_TRANSITION',
      `Cannot transition booking from "${fromState}" to "${toState}".`
    );
  }
}