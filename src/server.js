import { loadConfig } from './config.js';
import { createMemoryRepository } from './repositories/memory.js';
import { createMockPaymentGateway } from './lib/mockPaymentGateway.js';
import { createEventService } from './services/eventService.js';
import { createBookingService } from './services/bookingService.js';
import { createApp } from './http/app.js';
import { registerApiRoutes } from './http/apiRoutes.js';

const config = loadConfig();
const repo = createMemoryRepository();
const paymentGateway = createMockPaymentGateway();

const eventService = createEventService({ repo });
const bookingService = createBookingService({ repo, paymentGateway });

const { server } = createApp({
  configureRoutes(router) {
    registerApiRoutes(router, { eventService, bookingService });
  },
});

server.listen(config.port, () => {
  console.log(`Event Ticketing server listening on http://localhost:${config.port}`);
});