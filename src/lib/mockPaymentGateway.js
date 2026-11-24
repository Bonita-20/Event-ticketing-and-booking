import { DomainError } from '../domain/errors.js';
import { newId } from '../domain/ids.js';

/**
 * Simulates charging a payment method asynchronously.
 * Never receives or stores a card number.
 */
export function createMockPaymentGateway() {
  return {
    async charge({ amountCents, reference, simulateDecline = false }) {
      if (!Number.isInteger(amountCents) || amountCents < 0) {
        throw new DomainError('VALIDATION', 'amountCents must be a non-negative integer.');
      }

      if (simulateDecline === true) {
        throw new DomainError(
          'PAYMENT_DECLINED',
          `Payment was declined for booking ${reference}.`
        );
      }

      return {
        transactionId: `tx_${newId()}`,
        amountCents,
        status: 'SUCCEEDED',
        processedAt: new Date().toISOString(),
      };
    },
  };
}