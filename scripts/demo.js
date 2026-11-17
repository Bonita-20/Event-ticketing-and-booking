import {
  createStore,
  createEvent,
  addTier,
  bookTickets,
  cancelBooking,
  findBookingByReference,
  joinWaitlist,
} from '../src/domain/inventory.js';

function formatMoney(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

console.log('=== Event Ticketing Platform: Build 1 Terminal Demo ===\n');

const store = createStore();

// 1. Organizer creates an event and adds a small VIP tier (capacity: 5)
const event = createEvent(store, {
  title: 'Lagos Tech & Sound Live',
  city: 'Lagos',
  venue: 'Landmark Centre',
  date: '2026-12-15T19:00:00Z',
});

const vipTier = addTier(store, event.id, {
  name: 'VIP Front Row',
  priceCents: 15000, // $150.00
  capacity: 5,
});

console.log(`1. Created event "${event.title}" at ${event.venue}, ${event.city}.`);
console.log(
  `   Added tier "${vipTier.name}" — Price: ${formatMoney(vipTier.priceCents)}, Capacity: ${vipTier.capacity}\n`
);

// 2. Bookings sell out the tier
const bookingA = bookTickets(store, {
  tierId: vipTier.id,
  attendeeName: 'Amaka Okafor',
  quantity: 3,
});
console.log(
  `2. ${bookingA.attendeeName} booked ${bookingA.quantity} tickets (${formatMoney(bookingA.totalCents)}). Ref: ${bookingA.reference}`
);

const bookingB = bookTickets(store, {
  tierId: vipTier.id,
  attendeeName: 'Tunde Bakare',
  quantity: 2,
});
console.log(
  `   ${bookingB.attendeeName} booked ${bookingB.quantity} tickets (${formatMoney(bookingB.totalCents)}). Ref: ${bookingB.reference}`
);
console.log('   -> Tier is now completely SOLD OUT (5/5 sold).\n');

// 3. Another attendee attempts to book and is refused cleanly
console.log('3. Chidi Nwosu tries to book 2 VIP tickets...');
try {
  bookTickets(store, {
    tierId: vipTier.id,
    attendeeName: 'Chidi Nwosu',
    quantity: 2,
  });
} catch (err) {
  console.log(`   -> Refused [${err.code}]: ${err.message}\n`);
}

// 4. Two attendees join the FIFO waitlist
const wait1 = joinWaitlist(store, {
  tierId: vipTier.id,
  attendeeName: 'Chidi Nwosu',
  quantity: 2,
});
const wait2 = joinWaitlist(store, {
  tierId: vipTier.id,
  attendeeName: 'Zainab Bello',
  quantity: 1,
});
console.log(`4. Waitlist signups:`);
console.log(`   -> ${wait1.entry.attendeeName} joined at position #${wait1.position}`);
console.log(`   -> ${wait2.entry.attendeeName} joined at position #${wait2.position}\n`);

// 5. Fast O(1) lookup by reference code before cancellation
const lookedUp = findBookingByReference(store, bookingB.reference);
console.log(
  `5. Fast O(1) lookup for ${bookingB.reference}: Found ${lookedUp.attendeeName} (${lookedUp.quantity} seats, status: ${lookedUp.status})\n`
);

// 6. Booking B is cancelled, freeing 2 seats and revealing the next person in line
console.log(`6. ${bookingB.attendeeName} cancels booking ${bookingB.reference}...`);
const cancellation = cancelBooking(store, bookingB.reference);
console.log(`   -> Released ${cancellation.releasedSeats} seats. Available now: ${cancellation.availableSeats}.`);
console.log(
  `   -> Next person in line on waitlist: ${cancellation.nextInLine.attendeeName} (wants ${cancellation.nextInLine.quantity} tickets)\n`
);

// 7. Verify double-cancellation protection
console.log('7. Attempting to cancel the same booking twice...');
try {
  cancelBooking(store, bookingB.reference);
} catch (err) {
  console.log(`   -> Blocked [${err.code}]: ${err.message}`);
}