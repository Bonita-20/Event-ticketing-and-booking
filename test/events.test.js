import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStore,
  createEvent,
  addTier,
  publishEvent,
  unpublishEvent,
  listEventSummaries,
} from '../src/domain/inventory.js';

describe('S02: Organizer creates an event', () => {
  it('saves valid event as a draft hidden from public list', () => {
    const store = createStore();
    const event = createEvent(store, {
      title: 'Lagos Tech Meetup',
      city: 'Lagos',
      venue: 'CcHUB Yaba',
      date: '2026-12-05T17:00:00Z',
    });

    assert.ok(event.id);
    assert.equal(event.published, false);
    assert.equal(listEventSummaries(store).length, 0);
    assert.equal(listEventSummaries(store, { publishedOnly: false }).length, 1);
  });

  it('rejects missing title, missing city, or invalid date with VALIDATION and saves nothing', () => {
    const store = createStore();

    assert.throws(
      () =>
        createEvent(store, {
          title: '   ',
          city: 'Lagos',
          venue: 'Venue',
          date: '2026-12-05T17:00:00Z',
        }),
      { code: 'VALIDATION' }
    );

    assert.throws(
      () =>
        createEvent(store, {
          title: 'Valid Title',
          city: '',
          venue: 'Venue',
          date: '2026-12-05T17:00:00Z',
        }),
      { code: 'VALIDATION' }
    );

    assert.throws(
      () =>
        createEvent(store, {
          title: 'Valid Title',
          city: 'Lagos',
          venue: 'Venue',
          date: 'not-a-real-date',
        }),
      { code: 'VALIDATION' }
    );

    assert.equal(store.events.size, 0);
  });
});

describe('S03: Organizer adds ticket tiers', () => {
  it('saves a valid tier with 0 sold and full capacity available', () => {
    const store = createStore();
    const event = createEvent(store, {
      title: 'Afrobeats Night',
      city: 'Lagos',
      venue: 'Eko Hotel',
      date: '2026-12-10T20:00:00Z',
    });

    const tier = addTier(store, event.id, {
      name: 'General',
      priceCents: 500000,
      capacity: 100,
    });

    assert.equal(tier.sold, 0);
    assert.equal(tier.available, 100);
    assert.equal(tier.priceCents, 500000);
  });

  it('rejects fractional prices or capacity < 1 with VALIDATION', () => {
    const store = createStore();
    const event = createEvent(store, {
      title: 'Afrobeats Night',
      city: 'Lagos',
      venue: 'Eko Hotel',
      date: '2026-12-10T20:00:00Z',
    });

    assert.throws(
      () =>
        addTier(store, event.id, {
          name: 'General',
          priceCents: 99.5,
          capacity: 50,
        }),
      { code: 'VALIDATION' }
    );

    assert.throws(
      () =>
        addTier(store, event.id, {
          name: 'General',
          priceCents: 5000,
          capacity: 0,
        }),
      { code: 'VALIDATION' }
    );
  });

  it('rejects adding a tier to a non-existent event with NOT_FOUND', () => {
    const store = createStore();

    assert.throws(
      () =>
        addTier(store, 'missing-event-id', {
          name: 'General',
          priceCents: 5000,
          capacity: 50,
        }),
      { code: 'NOT_FOUND' }
    );
  });
});

describe('S04: Organizer publishes and unpublishes an event', () => {
  it('publishes a draft event with tiers so it appears on the public list', () => {
    const store = createStore();
    const event = createEvent(store, {
      title: 'Design Conf',
      city: 'Abuja',
      venue: 'ICC',
      date: '2026-12-12T10:00:00Z',
    });
    addTier(store, event.id, { name: 'Standard', priceCents: 10000, capacity: 50 });

    const published = publishEvent(store, event.id);
    assert.equal(published.published, true);
    assert.equal(listEventSummaries(store).length, 1);
  });

  it('rejects publishing an event with no tiers with INVALID_STATE', () => {
    const store = createStore();
    const event = createEvent(store, {
      title: 'Empty Event',
      city: 'Abuja',
      venue: 'ICC',
      date: '2026-12-12T10:00:00Z',
    });

    assert.throws(() => publishEvent(store, event.id), { code: 'INVALID_STATE' });
    assert.equal(listEventSummaries(store).length, 0);
  });

  it('unpublishes a published event and hides it from the public list', () => {
    const store = createStore();
    const event = createEvent(store, {
      title: 'Design Conf',
      city: 'Abuja',
      venue: 'ICC',
      date: '2026-12-12T10:00:00Z',
    });
    addTier(store, event.id, { name: 'Standard', priceCents: 10000, capacity: 50 });
    publishEvent(store, event.id);

    const unpublished = unpublishEvent(store, event.id);
    assert.equal(unpublished.published, false);
    assert.equal(listEventSummaries(store).length, 0);
  });
});