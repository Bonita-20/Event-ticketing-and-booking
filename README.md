# Event Ticketing & Booking Platform

A backend-first event ticketing system built incrementally across 9 builds.

## Build 1: Domain Core (In-Memory)

Pure JavaScript (ES Modules, Node 22.13+, zero external dependencies) implementing:
- Event and ticket tier creation (money stored strictly in integer cents)
- Atomic ticket reservations with capacity enforcement (1–10 tickets per booking)
- $O(1)$ booking lookup via `Map` using human-readable reference codes
- $O(1)$ FIFO waitlist queue backed by a singly linked list

### Run Commands
```bash
npm run demo       # Runs end-to-end terminal walkthrough
npm run benchmark  # Compares O(1) Map lookup vs O(n) Array.find