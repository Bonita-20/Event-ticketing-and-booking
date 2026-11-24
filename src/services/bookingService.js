import { DomainError } from '../domain/errors.js';
import { newId, newReference } from '../domain/ids.js';
import { BOOKING_STATES, assertTransition } from '../domain/bookingStateMachine.js';

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainError('VALIDATION', `${fieldName} must be a non-empty string.`);
  }
}

export function createBookingService({ repo, paymentGateway }) {
  if (!repo || !paymentGateway) {
    throw new Error('bookingService requires repo and paymentGateway');
  }

  return {
    async createBooking({ userId, tierId, attendeeName, quantity }) {
      assertNonEmptyString(userId, 'userId');
      assertNonEmptyString(tierId, 'tierId');

      const resolvedAttendeeName =
        typeof attendeeName === 'string' && attendeeName.trim().length > 0
          ? attendeeName.trim()
          : userId.trim();

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        throw new DomainError('VALIDATION', 'quantity must be an integer between 1 and 10.');
      }

      const tier = await repo.getTierById(tierId);
      if (!tier) {
        throw new DomainError('NOT_FOUND', `Tier not found: ${tierId}`);
      }

      const event = await repo.getEventById(tier.eventId);
      if (!event || !event.published) {
        throw new DomainError('INVALID_STATE', 'Cannot book tickets for an unpublished event.');
      }

      const remaining = tier.capacity - tier.sold;
      if (remaining < quantity) {
        throw new DomainError(
          'SOLD_OUT',
          `Not enough seats in "${tier.name}". Requested ${quantity}, available ${remaining}.`
        );
      }

      let reference = newReference();
      while (await repo.getBookingByReference(reference)) {
        reference = newReference();
      }

      tier.sold += quantity;
      await repo.updateTier(tier);

      const booking = {
        id: newId(),
        reference,
        eventId: tier.eventId,
        tierId: tier.id,
        userId: userId.trim(),
        attendeeName: resolvedAttendeeName,
        quantity,
        totalCents: tier.priceCents * quantity,
        status: BOOKING_STATES.PENDING,
        createdAt: new Date().toISOString(),
      };

      return repo.createBooking(booking);
    },

    async payBooking(reference, { userId, simulateDecline = false }) {
      assertNonEmptyString(reference, 'reference');
      assertNonEmptyString(userId, 'userId');

      const booking = await repo.getBookingByReference(reference);
      if (!booking) {
        throw new DomainError('NOT_FOUND', `Booking not found: ${reference}`);
      }

      if (booking.userId !== userId.trim()) {
        throw new DomainError('FORBIDDEN', 'You can only pay for your own booking.');
      }

      // Enforce state machine before charging (rejects already paid, cancelled, etc.)
      assertTransition(booking.status, BOOKING_STATES.PAID);

      // Charge gateway; if declined, DomainError('PAYMENT_DECLINED') throws and booking stays pending
      const payment = await paymentGateway.charge({
        amountCents: booking.totalCents,
        reference: booking.reference,
        simulateDecline,
      });

      booking.status = BOOKING_STATES.PAID;
      booking.transactionId = payment.transactionId;
      booking.paidAt = payment.processedAt;

      return repo.updateBooking(booking);
    },

    async cancelBooking(reference, { userId }) {
      assertNonEmptyString(reference, 'reference');
      assertNonEmptyString(userId, 'userId');

      const booking = await repo.getBookingByReference(reference);
      if (!booking) {
        throw new DomainError('NOT_FOUND', `Booking not found: ${reference}`);
      }

      if (booking.userId !== userId.trim()) {
        throw new DomainError('FORBIDDEN', 'You can only cancel your own booking.');
      }

      // Build 4 allows cancelling unpaid (pending) bookings only
      if (booking.status !== BOOKING_STATES.PENDING) {
        throw new DomainError(
          'INVALID_TRANSITION',
          `Only pending bookings can be cancelled in this build (current status: "${booking.status}").`
        );
      }

      assertTransition(booking.status, BOOKING_STATES.CANCELLED);

      const tier = await repo.getTierById(booking.tierId);
      if (tier) {
        tier.sold = Math.max(0, tier.sold - booking.quantity);
        await repo.updateTier(tier);
      }

      booking.status = BOOKING_STATES.CANCELLED;
      booking.cancelledAt = new Date().toISOString();

      return repo.updateBooking(booking);
    },
  };
}