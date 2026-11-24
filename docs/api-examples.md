# REST API Examples (Build 4)

Start the server first:

```bash
npm start
```

Create an Event (Draft):

```bash
curl -s -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -H "x-user-id: org-1" \
  -d '{
    "title": "Lagos Tech & Sound Live",
    "city": "Lagos",
    "venue": "Landmark Centre",
    "date": "2026-12-15T19:00:00Z"
  }'
```

Add a Ticket Tier:

```bash
curl -s -X POST http://localhost:3000/api/events/$EVENT_ID/tiers \
  -H "Content-Type: application/json" \
  -H "x-user-id: org-1" \
  -d '{
    "name": "General Admission",
    "priceCents": 500000,
    "capacity": 100
  }'
```

Publish the Event:

```bash
curl -s -X POST http://localhost:3000/api/events/$EVENT_ID/publish \
  -H "x-user-id: org-1"
```

Search, Filter, and Sort Published Events:

```bash
curl -s "http://localhost:3000/api/events?city=lagos&q=tech&maxPriceCents=600000&sort=price"
```

Book Tickets (Creates a pending Booking):

```bash
curl -s -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -H "x-user-id: attendee-1" \
  -d '{
    "tierId": "'$TIER_ID'",
    "attendeeName": "Amaka Okafor",
    "quantity": 2
  }'
```

Pay for the Booking (Mock Payment):

Simulate a declined payment first (booking stays pending):
```bash
curl -s -X POST http://localhost:3000/api/bookings/$BOOKING_REF/pay \
  -H "Content-Type: application/json" \
  -H "x-user-id: attendee-1" \
  -d '{"simulateDecline": true}'
```

Complete payment successfully:
```bash
curl -s -X POST http://localhost:3000/api/bookings/$BOOKING_REF/pay \
  -H "Content-Type: application/json" \
  -H "x-user-id: attendee-1" \
  -d '{"simulateDecline": false}'
```

Cancel an Unpaid (pending) Booking:

```bash
curl -s -X POST http://localhost:3000/api/bookings/$PENDING_REF/cancel \
  -H "x-user-id: attendee-1"
```