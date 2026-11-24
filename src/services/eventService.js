import { DomainError } from '../domain/errors.js';
import { newId } from '../domain/ids.js';
import { searchEvents } from '../domain/eventSearch.js';

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DomainError('VALIDATION', `${fieldName} must be a non-empty string.`);
  }
}

export function createEventService({ repo }) {
  if (!repo) {
    throw new Error('eventService requires a repository');
  }

  return {
    async createEvent({ organizerId, title, city, venue, date }) {
      assertNonEmptyString(organizerId, 'organizerId');
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
        organizerId: organizerId.trim(),
        title: title.trim(),
        city: city.trim(),
        venue: venue.trim(),
        date: new Date(parsedDate).toISOString(),
        published: false,
        tierIds: [],
      };

      return repo.createEvent(event);
    },

    async addTier(eventId, { organizerId, name, priceCents, capacity }) {
      assertNonEmptyString(eventId, 'eventId');
      assertNonEmptyString(organizerId, 'organizerId');

      const event = await repo.getEventById(eventId);
      if (!event) {
        throw new DomainError('NOT_FOUND', `Event not found: ${eventId}`);
      }

      if (event.organizerId !== organizerId.trim()) {
        throw new DomainError('FORBIDDEN', 'Only the event organizer can add tiers.');
      }

      assertNonEmptyString(name, 'name');
      if (!Number.isInteger(priceCents) || priceCents < 0) {
        throw new DomainError('VALIDATION', 'priceCents must be a non-negative integer.');
      }
      if (!Number.isInteger(capacity) || capacity <= 0) {
        throw new DomainError('VALIDATION', 'capacity must be a positive integer.');
      }

      const tier = await repo.createTier({
        id: newId(),
        eventId: event.id,
        name: name.trim(),
        priceCents,
        capacity,
        sold: 0,
      });

      return {
        ...tier,
        available: tier.capacity - tier.sold,
      };
    },

    async publishEvent(eventId, { organizerId }) {
      assertNonEmptyString(eventId, 'eventId');
      assertNonEmptyString(organizerId, 'organizerId');

      const event = await repo.getEventById(eventId);
      if (!event) {
        throw new DomainError('NOT_FOUND', `Event not found: ${eventId}`);
      }

      if (event.organizerId !== organizerId.trim()) {
        throw new DomainError('FORBIDDEN', 'Only the event organizer can publish this event.');
      }

      const tiers = await repo.listTiersByEventId(event.id);
      if (tiers.length === 0) {
        throw new DomainError(
          'INVALID_STATE',
          'Cannot publish an event that has no ticket tiers.'
        );
      }

      event.published = true;
      return repo.updateEvent(event);
    },

    async unpublishEvent(eventId, { organizerId }) {
      assertNonEmptyString(eventId, 'eventId');
      assertNonEmptyString(organizerId, 'organizerId');

      const event = await repo.getEventById(eventId);
      if (!event) {
        throw new DomainError('NOT_FOUND', `Event not found: ${eventId}`);
      }

      if (event.organizerId !== organizerId.trim()) {
        throw new DomainError('FORBIDDEN', 'Only the event organizer can unpublish this event.');
      }

      event.published = false;
      return repo.updateEvent(event);
    },

    async searchPublishedEvents(criteria = {}, sortBy = 'date') {
      const allEvents = await repo.listEvents();
      const publishedEvents = allEvents.filter((e) => e.published);

      const summaries = [];
      for (const event of publishedEvents) {
        const tiers = await repo.listTiersByEventId(event.id);
        let minPriceCents = null;
        let totalCapacity = 0;
        let availableSeats = 0;

        for (const tier of tiers) {
          totalCapacity += tier.capacity;
          availableSeats += tier.capacity - tier.sold;
          if (minPriceCents === null || tier.priceCents < minPriceCents) {
            minPriceCents = tier.priceCents;
          }
        }

        summaries.push({
          id: event.id,
          title: event.title,
          city: event.city,
          venue: event.venue,
          date: event.date,
          published: event.published,
          tierCount: tiers.length,
          minPriceCents,
          totalCapacity,
          availableSeats,
        });
      }

      return searchEvents(summaries, criteria, sortBy);
    },
  };
}