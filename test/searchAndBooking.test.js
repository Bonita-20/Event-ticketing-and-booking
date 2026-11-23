import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStore,
  createEvent,
  addTier,
  publishEvent,
  listEventSummaries,
  bookTickets,
} from '../src/domain/inventory.js';
import {
  filterEvents,
  sortEvents,
  searchEvents,
} from '../src/domain/Search.js';
import { mergeSort } from '../src/domain/sorting.js';

function seedSampleStore() {
  const store = createStore();

  const e1 = createEvent(store, {
    title: 'Lagos Tech Meetup',
    city: 'Lagos',
    venue: 'Landmark Centre',
    date: '2026-12-05T17:00:00Z',
  });
  addTier(store, e1.id, { name: 'Regular', priceCents: 10000, capacity: 50 });
  addTier(store, e1.id, { name: 'VIP', priceCents: 30000, capacity: 10 });
  publishEvent(store, e1.id);

  const e2 = createEvent(store, {
    title: 'Abuja Jazz Night',
    city: 'Abuja',
    venue: 'Transcorp Hilton',
    date: '2026-12-05T12:00:00Z',
  });
  addTier(store, e2.id, { name: 'Entry', priceCents: 5000, capacity: 20 });
  publishEvent(store, e2.id);

  const e3 = createEvent(store, {
    title: 'Alpha Evening Gala',
    city: 'Lagos',
    venue: 'Eko Convention',
    date: '2026-12-05T17:00:00Z',
  });
  addTier(store, e3.id, { name: 'Standard', priceCents: 20000, capacity: 100 });
  publishEvent(store, e3.id);

  return { store, e1, e2, e3 };
}

describe('Merge Sort stability and immutability', () => {
  it('preserves relative order of equal keys (stability) and never mutates input', () => {
    const original = [
      { id: 1, group: 'A' },
      { id: 2, group: 'B' },
      { id: 3, group: 'A' },
      { id: 4, group: 'B' },
    ];
    const snapshot = structuredClone(original);

    const sorted = mergeSort(original, (a, b) => a.group.localeCompare(b.group));

    assert.deepEqual(original, snapshot);
    assert.notEqual(sorted, original);
    assert.deepEqual(
      sorted.map((x) => x.id),
      [1, 3, 2, 4]
    );
  });

  it('handles an empty list cleanly', () => {
    assert.deepEqual(mergeSort([], (a, b) => a - b), []);
    assert.deepEqual(searchEvents([], { q: 'jazz' }, 'date'), []);
  });
});

describe('S05: Search, filter, and sort published events', () => {
  it('matches text search case-insensitively on title or venue', () => {
    const { store } = seedSampleStore();
    const summaries = listEventSummaries(store);

    const byTitle = filterEvents(summaries, { q: 'JAZZ' });
    assert.equal(byTitle.length, 1);
    assert.equal(byTitle[0].title, 'Abuja Jazz Night');

    const byVenue = filterEvents(summaries, { q: 'landmark' });
    assert.equal(byVenue.length, 1);
    assert.equal(byVenue[0].title, 'Lagos Tech Meetup');
  });

  it('filters by city case-insensitively', () => {
    const { store } = seedSampleStore();
    const summaries = listEventSummaries(store);

    const lagosEvents = filterEvents(summaries, { city: 'lagos' });
    assert.equal(lagosEvents.length, 2);
    assert.ok(lagosEvents.every((e) => e.city === 'Lagos'));
  });

  it('filters by maxPriceCents using cheapest tier, excludes tierless events, and sorts cheapest first', () => {
    const { store } = seedSampleStore();
    const summaries = listEventSummaries(store);

    // Add a synthetic summary with no tiers to verify exclusion
    const withTierless = [
      ...summaries,
      {
        id: 'tierless-1',
        title: 'No Tier Event',
        city: 'Lagos',
        venue: 'Nowhere',
        date: '2026-12-06T10:00:00Z',
        published: true,
        tierCount: 0,
        minPriceCents: null,
        totalCapacity: 0,
        availableSeats: 0,
      },
    ];

    const results = searchEvents(withTierless, { maxPriceCents: 10000 }, 'price');
    assert.deepEqual(
      results.map((e) => e.title),
      ['Abuja Jazz Night', 'Lagos Tech Meetup']
    );
  });

  it('sorts by date earliest first and breaks timestamp ties by title order', () => {
    const { store } = seedSampleStore();
    const summaries = listEventSummaries(store);

    const sorted = sortEvents(summaries, 'date');
    assert.deepEqual(
      sorted.map((e) => e.title),
      ['Abuja Jazz Night', 'Alpha Evening Gala', 'Lagos Tech Meetup']
    );
  });

  it('includes a 5 PM event when filtering with date-only upper bound 2026-12-05', () => {
    const { store } = seedSampleStore();
    const summaries = listEventSummaries(store);

    const results = filterEvents(summaries, { to: '2026-12-05' });
    assert.equal(results.length, 3);
  });

  it('rejects bad date, fractional price, or unknown sort option with VALIDATION', () => {
    const { store } = seedSampleStore();
    const summaries = listEventSummaries(store);

    assert.throws(() => filterEvents(summaries, { from: 'invalid-date' }), {
      code: 'VALIDATION',
    });
    assert.throws(() => filterEvents(summaries, { maxPriceCents: 12.34 }), {
      code: 'VALIDATION',
    });
    assert.throws(() => sortEvents(summaries, 'popularity'), {
      code: 'VALIDATION',
    });
  });

  it('leaves the original summaries array completely unchanged after search, filter, and sort', () => {
    const { store } = seedSampleStore();
    const summaries = listEventSummaries(store);
    const before = structuredClone(summaries);

    searchEvents(summaries, { city: 'lagos', maxPriceCents: 25000 }, 'availability');

    assert.deepEqual(summaries, before);
  });
});

describe('S06: Attendee books tickets from a tier', () => {
  it('creates a booking in whole cents and reduces remaining seats', () => {
    const store = createStore();
    const event = createEvent(store, {
      title: 'Concert',
      city: 'Lagos',
      venue: 'Arena',
      date: '2026-12-15T19:00:00Z',
    });
    const tier = addTier(store, event.id, {
      name: 'General',
      priceCents: 2500,
      capacity: 3,
    });
    publishEvent(store, event.id);

    const booking = bookTickets(store, {
      tierId: tier.id,
      attendeeName: 'Kemi',
      quantity: 2,
    });

    assert.equal(booking.quantity, 2);
    assert.equal(booking.totalCents, 5000);
    assert.equal(store.tiers.get(tier.id).capacity - store.tiers.get(tier.id).sold, 1);
  });

  it('rejects booking when requested quantity exceeds remaining seats with SOLD_OUT and changes nothing', () => {
    const store = createStore();
    const event = createEvent(store, {
      title: 'Concert',
      city: 'Lagos',
      venue: 'Arena',
      date: '2026-12-15T19:00:00Z',
    });
    const tier = addTier(store, event.id, {
      name: 'General',
      priceCents: 2500,
      capacity: 1,
    });
    publishEvent(store, event.id);

    assert.throws(
      () =>
        bookTickets(store, {
          tierId: tier.id,
          attendeeName: 'Kemi',
          quantity: 2,
        }),
      { code: 'SOLD_OUT' }
    );

    assert.equal(store.tiers.get(tier.id).sold, 0);
    assert.equal(store.bookingsById.size, 0);
  });

  it('rejects 0, negative, fractional, or > 10 ticket quantities with VALIDATION', () => {
    const store = createStore();
    const event = createEvent(store, {
      title: 'Concert',
      city: 'Lagos',
      venue: 'Arena',
      date: '2026-12-15T19:00:00Z',
    });
    const tier = addTier(store, event.id, {
      name: 'General',
      priceCents: 2500,
      capacity: 50,
    });

    for (const badQty of [0, -2, 1.5, 11]) {
      assert.throws(
        () =>
          bookTickets(store, {
            tierId: tier.id,
            attendeeName: 'Kemi',
            quantity: badQty,
          }),
        { code: 'VALIDATION' }
      );
    }
  });
});