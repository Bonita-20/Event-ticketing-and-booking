import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepository } from '../src/repositories/memory.js';
import { createMockPaymentGateway } from '../src/lib/mockPaymentGateway.js';
import { createEventService } from '../src/services/eventService.js';
import { createBookingService } from '../src/services/bookingService.js';
import { createApp } from '../src/http/app.js';
import { registerApiRoutes } from '../src/http/apiRoutes.js';

describe('Build 4 REST API Integration Tests (S02 - S07)', () => {
  const repo = createMemoryRepository();
  const paymentGateway = createMockPaymentGateway();
  const eventService = createEventService({ repo });
  const bookingService = createBookingService({ repo, paymentGateway });

  const { server } = createApp({
    configureRoutes(router) {
      registerApiRoutes(router, { eventService, bookingService });
    },
  });

  let baseUrl = '';
  const ready = new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  after(() => {
    server.close();
  });

  async function api(path, { method = 'GET', userId, body } = {}) {
    await ready;
    const headers = {};
    if (userId) headers['x-user-id'] = userId;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    return { status: res.status, json };
  }

  it('supports full organizer flow: create draft, add tier, publish, and search (S02-S05)', async () => {
    // S02: Create event as draft
    const created = await api('/api/events', {
      method: 'POST',
      userId: 'org-1',
      body: {
        title: 'Abuja Jazz Night',
        city: 'Abuja',
        venue: 'Transcorp Hilton',
        date: '2026-12-10T20:00:00Z',
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.json.event.published, false);
    const eventId = created.json.event.id;

    // Draft is hidden from GET /api/events
    const beforePublish = await api('/api/events');
    assert.equal(beforePublish.status, 200);
    assert.equal(beforePublish.json.events.length, 0);

    // S03: Add ticket tier
    const tierRes = await api(`/api/events/${eventId}/tiers`, {
      method: 'POST',
      userId: 'org-1',
      body: { name: 'VIP', priceCents: 15000, capacity: 5 },
    });
    assert.equal(tierRes.status, 201);
    assert.equal(tierRes.json.tier.available, 5);

    // S04: Publish event
    const pubRes = await api(`/api/events/${eventId}/publish`, {
      method: 'POST',
      userId: 'org-1',
    });
    assert.equal(pubRes.status, 200);
    assert.equal(pubRes.json.event.published, true);

    // S05: Search & filter returns published event
    const searchRes = await api('/api/events?city=abuja&q=JAZZ&sort=price');
    assert.equal(searchRes.status, 200);
    assert.equal(searchRes.json.events.length, 1);
    assert.equal(searchRes.json.events[0].title, 'Abuja Jazz Night');
  });

  it('supports booking, declined retry, successful payment, double-pay rejection, and ownership checks (S06 & S07)', async () => {
    // Setup published event with 3 seats
    const { json: evJson } = await api('/api/events', {
      method: 'POST',
      userId: 'org-2',
      body: {
        title: 'Lagos Indie Fest',
        city: 'Lagos',
        venue: 'Terra Kulture',
        date: '2026-12-18T18:00:00Z',
      },
    });
    const eventId = evJson.event.id;

    const { json: tierJson } = await api(`/api/events/${eventId}/tiers`, {
      method: 'POST',
      userId: 'org-2',
      body: { name: 'Standard', priceCents: 8000, capacity: 3 },
    });
    const tierId = tierJson.tier.id;

    await api(`/api/events/${eventId}/publish`, {
      method: 'POST',
      userId: 'org-2',
    });

    // S06: Book 2 tickets -> pending
    const bookRes = await api('/api/bookings', {
      method: 'POST',
      userId: 'user-alice',
      body: { tierId, attendeeName: 'Alice', quantity: 2 },
    });
    assert.equal(bookRes.status, 201);
    assert.equal(bookRes.json.booking.status, 'pending');
    assert.equal(bookRes.json.booking.totalCents, 16000);
    const ref = bookRes.json.booking.reference;

    // S06 edge case: Booking 2 more when only 1 left -> SOLD_OUT (409)
    const soldOutRes = await api('/api/bookings', {
      method: 'POST',
      userId: 'user-bob',
      body: { tierId, attendeeName: 'Bob', quantity: 2 },
    });
    assert.equal(soldOutRes.status, 409);
    assert.equal(soldOutRes.json.error.code, 'SOLD_OUT');

    // Ownership check: Bob cannot pay for Alice's booking
    const wrongUserRes = await api(`/api/bookings/${ref}/pay`, {
      method: 'POST',
      userId: 'user-bob',
      body: {},
    });
    assert.equal(wrongUserRes.status, 403);
    assert.equal(wrongUserRes.json.error.code, 'FORBIDDEN');

    // S07: Declined card returns PAYMENT_DECLINED and leaves booking pending
    const declinedRes = await api(`/api/bookings/${ref}/pay`, {
      method: 'POST',
      userId: 'user-alice',
      body: { simulateDecline: true },
    });
    assert.equal(declinedRes.status, 402);
    assert.equal(declinedRes.json.error.code, 'PAYMENT_DECLINED');

    // S07: Retry payment succeeds -> paid
    const paidRes = await api(`/api/bookings/${ref}/pay`, {
      method: 'POST',
      userId: 'user-alice',
      body: { simulateDecline: false },
    });
    assert.equal(paidRes.status, 200);
    assert.equal(paidRes.json.booking.status, 'paid');
    assert.ok(paidRes.json.booking.transactionId);

    // S07: Paying again is rejected with INVALID_TRANSITION
    const payAgainRes = await api(`/api/bookings/${ref}/pay`, {
      method: 'POST',
      userId: 'user-alice',
      body: {},
    });
    assert.equal(payAgainRes.status, 409);
    assert.equal(payAgainRes.json.error.code, 'INVALID_TRANSITION');
  });

  it('cancels an unpaid booking, releases seats, and rejects paying a cancelled booking', async () => {
    const { json: evJson } = await api('/api/events', {
      method: 'POST',
      userId: 'org-3',
      body: {
        title: 'Port Harcourt Comedy',
        city: 'Port Harcourt',
        venue: 'Aztech Arcum',
        date: '2026-12-22T19:00:00Z',
      },
    });
    const { json: tierJson } = await api(`/api/events/${evJson.event.id}/tiers`, {
      method: 'POST',
      userId: 'org-3',
      body: { name: 'Regular', priceCents: 4000, capacity: 2 },
    });
    await api(`/api/events/${evJson.event.id}/publish`, {
      method: 'POST',
      userId: 'org-3',
    });

    const { json: bookJson } = await api('/api/bookings', {
      method: 'POST',
      userId: 'user-charlie',
      body: { tierId: tierJson.tier.id, quantity: 2 },
    });
    const ref = bookJson.booking.reference;

    // Cancel pending booking -> releases 2 seats
    const cancelRes = await api(`/api/bookings/${ref}/cancel`, {
      method: 'POST',
      userId: 'user-charlie',
    });
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.json.booking.status, 'cancelled');

    // Trying to pay a cancelled booking -> INVALID_TRANSITION
    const payCancelledRes = await api(`/api/bookings/${ref}/pay`, {
      method: 'POST',
      userId: 'user-charlie',
      body: {},
    });
    assert.equal(payCancelledRes.status, 409);
    assert.equal(payCancelledRes.json.error.code, 'INVALID_TRANSITION');

    // Released seats can now be booked by someone else
    const rebookRes = await api('/api/bookings', {
      method: 'POST',
      userId: 'user-dana',
      body: { tierId: tierJson.tier.id, quantity: 2 },
    });
    assert.equal(rebookRes.status, 201);
  });
});