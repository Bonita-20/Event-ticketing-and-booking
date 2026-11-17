import { performance } from 'node:perf_hooks';
import {
  createStore,
  createEvent,
  addTier,
  bookTickets,
  findBookingByReference,
} from '../src/domain/inventory.js';

const TOTAL_BOOKINGS = 100_000;
const LOOKUP_ITERATIONS = 5_000;

console.log(`Setting up ${TOTAL_BOOKINGS.toLocaleString()} bookings...`);

const store = createStore();
const event = createEvent(store, {
  title: 'Benchmark Fest',
  city: 'Abuja',
  venue: 'Eagle Square',
  date: '2026-12-20T18:00:00Z',
});

const tier = addTier(store, event.id, {
  name: 'General Admission',
  priceCents: 5000,
  capacity: TOTAL_BOOKINGS,
});

const bookingsArray = [];

for (let i = 0; i < TOTAL_BOOKINGS; i += 1) {
  const booking = bookTickets(store, {
    tierId: tier.id,
    attendeeName: `Attendee ${i}`,
    quantity: 1,
  });
  bookingsArray.push(booking);
}

// Target bookings near the end of the dataset (worst-case for linear scan)
const sampleRefs = [];
for (let i = 0; i < LOOKUP_ITERATIONS; i += 1) {
  const idx = TOTAL_BOOKINGS - 1 - (i % 1000);
  sampleRefs.push(bookingsArray[idx].reference);
}

// 1. Benchmark Map.get via findBookingByReference — O(1)
const mapStart = performance.now();
for (const ref of sampleRefs) {
  const found = findBookingByReference(store, ref);
  if (!found) throw new Error('Unexpected miss in Map lookup');
}
const mapDurationMs = performance.now() - mapStart;

// 2. Benchmark Array.prototype.find — O(n)
const arrayStart = performance.now();
for (const ref of sampleRefs) {
  const found = bookingsArray.find((b) => b.reference === ref);
  if (!found) throw new Error('Unexpected miss in Array.find lookup');
}
const arrayDurationMs = performance.now() - arrayStart;

const speedup = (arrayDurationMs / mapDurationMs).toFixed(1);

console.log(`\n=== Lookup Benchmark (${LOOKUP_ITERATIONS.toLocaleString()} lookups across ${TOTAL_BOOKINGS.toLocaleString()} bookings) ===`);
console.log(`Map.get (O(1)):      ${mapDurationMs.toFixed(2)} ms`);
console.log(`Array.find (O(n)):   ${arrayDurationMs.toFixed(2)} ms`);
console.log(`Result:              Map.get is ~${speedup}x faster than Array.find`);