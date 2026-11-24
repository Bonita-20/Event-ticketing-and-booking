import { DomainError } from '../domain/errors.js';
import { sendJson } from './app.js';

function requireUserId(req) {
  const userId = req.headers['x-user-id'];
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    throw new DomainError('UNAUTHORIZED', 'Missing required x-user-id header.');
  }
  return userId.trim();
}

export function registerApiRoutes(router, { eventService, bookingService }) {
  // S02: Create event (draft)
  router.post('/api/events', async (req, res) => {
    const organizerId = requireUserId(req);
    const { title, city, venue, date } = req.body ?? {};
    const event = await eventService.createEvent({
      organizerId,
      title,
      city,
      venue,
      date,
    });
    sendJson(res, 201, { event });
  });

  // S03: Add ticket tier to event
  router.post('/api/events/:id/tiers', async (req, res) => {
    const organizerId = requireUserId(req);
    const { name, priceCents, capacity } = req.body ?? {};
    const tier = await eventService.addTier(req.params.id, {
      organizerId,
      name,
      priceCents,
      capacity,
    });
    sendJson(res, 201, { tier });
  });

  // S04: Publish & unpublish event
  router.post('/api/events/:id/publish', async (req, res) => {
    const organizerId = requireUserId(req);
    const event = await eventService.publishEvent(req.params.id, { organizerId });
    sendJson(res, 200, { event });
  });

  router.post('/api/events/:id/unpublish', async (req, res) => {
    const organizerId = requireUserId(req);
    const event = await eventService.unpublishEvent(req.params.id, { organizerId });
    sendJson(res, 200, { event });
  });

  // S05: Search, filter, and sort published events
  router.get('/api/events', async (req, res) => {
    const q = req.query.get('q') ?? undefined;
    const city = req.query.get('city') ?? undefined;
    const from = req.query.get('from') ?? undefined;
    const to = req.query.get('to') ?? undefined;
    const sortBy = req.query.get('sort') ?? 'date';
    const onlyAvailable = req.query.get('onlyAvailable') === 'true';

    const rawMaxPrice = req.query.get('maxPriceCents');
    let maxPriceCents;
    if (rawMaxPrice !== null && rawMaxPrice !== '') {
      maxPriceCents = Number(rawMaxPrice);
    }

    const events = await eventService.searchPublishedEvents(
      { q, city, from, to, maxPriceCents, onlyAvailable },
      sortBy
    );
    sendJson(res, 200, { events });
  });

  // S06: Book tickets from a tier
  router.post('/api/bookings', async (req, res) => {
    const userId = requireUserId(req);
    const { tierId, attendeeName, quantity } = req.body ?? {};
    const booking = await bookingService.createBooking({
      userId,
      tierId,
      attendeeName,
      quantity,
    });
    sendJson(res, 201, { booking });
  });

  // S07: Pay for a pending booking
  router.post('/api/bookings/:reference/pay', async (req, res) => {
    const userId = requireUserId(req);
    const { simulateDecline = false } = req.body ?? {};
    const booking = await bookingService.payBooking(req.params.reference, {
      userId,
      simulateDecline: Boolean(simulateDecline),
    });
    sendJson(res, 200, { booking });
  });

  // Cancel an unpaid (pending) booking
  router.post('/api/bookings/:reference/cancel', async (req, res) => {
    const userId = requireUserId(req);
    const booking = await bookingService.cancelBooking(req.params.reference, {
      userId,
    });
    sendJson(res, 200, { booking });
  });
}