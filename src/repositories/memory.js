/**
 * Creates an async in-memory repository for events, ticket tiers, and bookings.
 * Returns defensive clones so callers cannot mutate stored records by accident.
 */
export function createMemoryRepository() {
  const events = new Map();
  const tiers = new Map();
  const bookingsById = new Map();
  const bookingsByRef = new Map();

  return {
    async createEvent(event) {
      const record = { ...event, tierIds: [...event.tierIds] };
      events.set(record.id, record);
      return { ...record, tierIds: [...record.tierIds] };
    },

    async getEventById(eventId) {
      const record = events.get(eventId);
      return record ? { ...record, tierIds: [...record.tierIds] } : null;
    },

    async updateEvent(event) {
      const record = { ...event, tierIds: [...event.tierIds] };
      events.set(record.id, record);
      return { ...record, tierIds: [...record.tierIds] };
    },

    async listEvents() {
      return Array.from(events.values()).map((e) => ({
        ...e,
        tierIds: [...e.tierIds],
      }));
    },

    async createTier(tier) {
      const record = { ...tier };
      tiers.set(record.id, record);

      const event = events.get(record.eventId);
      if (event && !event.tierIds.includes(record.id)) {
        event.tierIds.push(record.id);
      }

      return { ...record };
    },

    async getTierById(tierId) {
      const record = tiers.get(tierId);
      return record ? { ...record } : null;
    },

    async updateTier(tier) {
      const record = { ...tier };
      tiers.set(record.id, record);
      return { ...record };
    },

    async listTiersByEventId(eventId) {
      const results = [];
      for (const tier of tiers.values()) {
        if (tier.eventId === eventId) {
          results.push({ ...tier });
        }
      }
      return results;
    },

    async createBooking(booking) {
      const record = { ...booking };
      bookingsById.set(record.id, record);
      bookingsByRef.set(record.reference, record);
      return { ...record };
    },

    async getBookingByReference(reference) {
      if (typeof reference !== 'string') return null;
      const record = bookingsByRef.get(reference.trim().toUpperCase());
      return record ? { ...record } : null;
    },

    async updateBooking(booking) {
      const record = { ...booking };
      bookingsById.set(record.id, record);
      bookingsByRef.set(record.reference, record);
      return { ...record };
    },
  };
}