# System Architecture

## 1. Layered Architecture

```mermaid
flowchart TD
    Client[Browser / HTTP Client] --> Routes[Routes / HTTP Layer<br/>src/http/]
    Routes --> Services[Services Layer<br/>src/services/]
    Services --> Domain[Domain Rules & State Machines<br/>src/domain/]
    Services --> Repos[Repositories / Data Access<br/>src/repositories/]

erDiagram
    USERS ||--o{ EVENTS : organizes
    USERS ||--o{ BOOKINGS : places
    EVENTS ||--|{ TICKET_TIERS : offers
    TICKET_TIERS ||--o{ BOOKINGS : reserves

    USERS {
        string id PK
        string email UK
        string name
        string role
        string passwordHash
        string createdAt
    }

    EVENTS {
        string id PK
        string organizerId FK
        string title
        string city
        string venue
        string date
        boolean published
    }

    TICKET_TIERS {
        string id PK
        string eventId FK
        string name
        int priceCents
        int capacity
        int sold
    }

    BOOKINGS {
        string id PK
        string reference UK
        string eventId FK
        string tierId FK
        string userId FK
        string attendeeName
        int quantity
        int totalCents
        string status
        string createdAt
    }

stateDiagram-v2
    [*] --> pending : bookTickets()
    pending --> paid : confirmPayment()
    pending --> cancelled : cancelBooking() / expireBooking()
    paid --> checked_in : checkInTicket()
    paid --> refunded : refundBooking()
    paid --> cancelled : cancelBooking()
    checked_in --> [*]
    refunded --> [*]
    cancelled --> [*]

### 2. Configuration (`package.json`)

Update `package.json` to include the `"start"` script:

```json
{
  "name": "event-ticketing-capstone",
  "version": "0.3.0",
  "description": "Event ticketing and booking platform — Build 3 Architecture, State Machine & Server",
  "type": "module",
  "engines": {
    "node": ">=22.13.0"
  },
  "scripts": {
    "start": "node src/server.js",
    "demo": "node scripts/demo.js",
    "benchmark": "node scripts/benchmark-lookup.js",
    "test": "node --test"
  }
}