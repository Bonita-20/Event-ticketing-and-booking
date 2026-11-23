import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOKING_STATES,
  ALL_STATES,
  ALLOWED_TRANSITIONS,
  canTransition,
  assertTransition,
} from '../src/domain/bookingStateMachine.js';

describe('Booking State Machine', () => {
  it('permits every defined valid transition', () => {
    const validPairs = [
      [BOOKING_STATES.PENDING, BOOKING_STATES.PAID],
      [BOOKING_STATES.PENDING, BOOKING_STATES.CANCELLED],
      [BOOKING_STATES.PAID, BOOKING_STATES.CHECKED_IN],
      [BOOKING_STATES.PAID, BOOKING_STATES.REFUNDED],
      [BOOKING_STATES.PAID, BOOKING_STATES.CANCELLED],
    ];

    for (const [from, to] of validPairs) {
      assert.equal(canTransition(from, to), true, `Expected ${from} -> ${to} to be allowed`);
      assert.doesNotThrow(() => assertTransition(from, to));
    }
  });

  it('refuses every illegal transition with INVALID_TRANSITION', () => {
    for (const from of ALL_STATES) {
      const allowedTargets = ALLOWED_TRANSITIONS[from];
      for (const to of ALL_STATES) {
        if (allowedTargets.includes(to)) continue;

        assert.equal(
          canTransition(from, to),
          false,
          `Expected ${from} -> ${to} to be disallowed`
        );
        assert.throws(
          () => assertTransition(from, to),
          { code: 'INVALID_TRANSITION' },
          `Expected ${from} -> ${to} to throw INVALID_TRANSITION`
        );
      }
    }
  });

  it('treats cancelled, refunded, and checked_in as terminal states', () => {
    const terminalStates = [
      BOOKING_STATES.CANCELLED,
      BOOKING_STATES.REFUNDED,
      BOOKING_STATES.CHECKED_IN,
    ];

    for (const terminal of terminalStates) {
      assert.equal(ALLOWED_TRANSITIONS[terminal].length, 0);
    }
  });

  it('refuses unknown states safely', () => {
    assert.equal(canTransition('unknown_state', BOOKING_STATES.PAID), false);
    assert.throws(
      () => assertTransition('unknown_state', BOOKING_STATES.PAID),
      { code: 'INVALID_TRANSITION' }
    );
  });
});