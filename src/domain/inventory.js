import { DomainError } from './errors.js';
import { newId, newReference } from './ids.js';
import { Queue } from './waitlistQueue.js';

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainError('VALIDATION', `${fieldName} must be a non-empty string.`);
  }
}

function assertPositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new DomainError('VALIDATION', `${fieldName} must be a positive integer.`);
  }
}

function assertNonNegativeInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new DomainError('VALIDATION', `${fieldName} must be a non-negative integer.`);
  }
}

/**
 * Creates an isolated in-memory store for events, tiers, bookings, and waitlists.
 */
export function createStore() {
  return {
    events: new Map(),
    tiers: new Map(),
    bookingsById: new Map(),
    bookingsByRef: new Map(),
    waitlistsByTier: new Map(),
  };
}

/**
 * Creates a new event in draft status.
 */
export function createEvent(store, { title, city, venue, date }) {
  assertNonEmptyString(title, 'title');
  assertNonEmptyString(city, 'city');
  assertNonEmptyString(venue, 'venue');
  assertNonEmptyString(date, 'date');

  const parsedDate = Date.parse(date);
  if (Number.isNaN(parsedDate)) {
    throw new DomainError('VALIDATION', 'date must be a valid ISO date string.');
  }

  const event = {
    id: newId(),
    title: title.trim(),
    city: city.trim(),
    venue: venue.trim(),
    date: new Date(parsedDate).toISOString(),
    published: false,
    tierIds: [],
  };

  store.events.set(event.id, event);
  return { ...event, tierIds: [...event.tierIds] };
}

/**
 * Adds a ticket tier to an existing event. Price must be integer cents.
 */
export function addTier(store, eventId, { name, priceCents, capacity }) {
  assertNonEmptyString(eventId, 'eventId');
  const event = store.events.get(eventId);
  if (!event) {
    throw new DomainError('NOT_FOUND', `Event not found: ${eventId}`);
  }

  assertNonEmptyString(name, 'name');
  assertNonNegativeInteger(priceCents, 'priceCents');
  assertPositiveInteger(capacity, 'capacity');

  const tier = {
    id: newId(),
    eventId: event.id,
    name: name.trim(),
    priceCents,
    capacity,
    sold: 0,
  };

  store.tiers.set(tier.id, tier);
  store.waitlistsByTier.set(tier.id, new Queue());
  event.tierIds.push(tier.id);

  return { ...tier, available: tier.capacity - tier.sold };
}

/**
 * Books 1 to 10 tickets from a single tier.
 * Atomic: validates everything before mutating store state.
 */
export function bookTickets(store, { tierId, attendeeName, quantity }) {
  assertNonEmptyString(tierId, 'tierId');
  assertNonEmptyString(attendeeName, 'attendeeName');

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new DomainError('VALIDATION', 'quantity must be an integer between 1 and 10.');
  }

  const tier = store.tiers.get(tierId);
  if (!tier) {
    throw new DomainError('NOT_FOUND', `Tier not found: ${tierId}`);
  }

  const remaining = tier.capacity - tier.sold;
  if (remaining < quantity) {
    throw new DomainError(
      'SOLD_OUT',
      `Not enough seats in "${tier.name}". Requested ${quantity}, available ${remaining}.`
    );
  }

  // Generate a collision-free human-readable reference code
  let reference = newReference();
  while (store.bookingsByRef.has(reference)) {
    reference = newReference();
  }

  // All checks passed — commit state changes
  tier.sold += quantity;

  const booking = {
    id: newId(),
    reference,
    eventId: tier.eventId,
    tierId: tier.id,
    attendeeName: attendeeName.trim(),
    quantity,
    totalCents: tier.priceCents * quantity,
    status: 'CONFIRMED',
    createdAt: new Date().toISOString(),
  };

  store.bookingsById.set(booking.id, booking);
  store.bookingsByRef.set(booking.reference, booking);

  return { ...booking };
}

/**
 * Cancels an active booking by ID or reference code and releases its seats.
 * Throws CONFLICT if already cancelled.
 */
export function cancelBooking(store, idOrReference) {
  assertNonEmptyString(idOrReference, 'idOrReference');

  const booking =
    store.bookingsById.get(idOrReference) ?? store.bookingsByRef.get(idOrReference);

  if (!booking) {
    throw new DomainError('NOT_FOUND', `Booking not found: ${idOrReference}`);
  }

  if (booking.status === 'CANCELLED') {
    throw new DomainError('CONFLICT', `Booking ${booking.reference} is already cancelled.`);
  }

  const tier = store.tiers.get(booking.tierId);
  if (!tier) {
    throw new DomainError('NOT_FOUND', `Associated tier not found: ${booking.tierId}`);
  }

  tier.sold -= booking.quantity;
  booking.status = 'CANCELLED';
  booking.cancelledAt = new Date().toISOString();

  const waitlist = store.waitlistsByTier.get(tier.id);
  const nextInLine = waitlist ? waitlist.peek() : undefined;

  return {
    booking: { ...booking },
    releasedSeats: booking.quantity,
    availableSeats: tier.capacity - tier.sold,
    nextInLine: nextInLine ? { ...nextInLine } : null,
  };
}

/**
 * Finds a booking by its reference code in O(1) average time.
 * Returns null if not found.
 */
export function findBookingByReference(store, reference) {
  if (typeof reference !== 'string' || reference.trim().length === 0) {
    return null;
  }
  const booking = store.bookingsByRef.get(reference.trim().toUpperCase());
  return booking ? { ...booking } : null;
}

/**
 * Adds an attendee to a tier's FIFO waitlist.
 */
export function joinWaitlist(store, { tierId, attendeeName, quantity = 1 }) {
  assertNonEmptyString(tierId, 'tierId');
  assertNonEmptyString(attendeeName, 'attendeeName');

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new DomainError('VALIDATION', 'quantity must be an integer between 1 and 10.');
  }

  const tier = store.tiers.get(tierId);
  if (!tier) {
    throw new DomainError('NOT_FOUND', `Tier not found: ${tierId}`);
  }

  const waitlist = store.waitlistsByTier.get(tier.id);
  const entry = {
    id: newId(),
    tierId: tier.id,
    attendeeName: attendeeName.trim(),
    quantity,
    joinedAt: new Date().toISOString(),
  };

  waitlist.enqueue(entry);

  return {
    entry: { ...entry },
    position: waitlist.size,
  };
}