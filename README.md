# Campus Connect — completed demo

Implemented event search and category filtering, upcoming-only listings, registration checks, cancellations with seat restoration, and organizer create/edit/cancel/delete actions.

## Run on Windows

Open this folder in VS Code, then run:

    npm.cmd install
    npm.cmd run dev

Open http://localhost:3000. Use the top-right menu to switch between Aditi (student), Rohan (organizer), or Signed out.

## Check the features

1. As organizer, create a future event with capacity 1.
2. Switch to student and find it through Events search/category filters.
3. Open it and confirm registration. Seats become 0 and duplicate registration is blocked.
4. In My Registrations, cancel it. The entry disappears and the seat returns.
5. Register again, then switch to organizer and increase capacity to 2. One seat remains booked.
6. Cancel/delete the event as its owner. It disappears from student listings and registrations.
7. Choose Signed out to verify registration requires an account.

## Storage and accounts

This follows the starter's in-memory demo model: the existing events and registrations arrays are the only data store. Mutations stay available during client-side navigation in the same tab, but a full browser refresh resets the demo. Accounts are simulated through the dropdown; this is not production authentication, cross-device storage, or a deployed backend. Dates use the device's actual clock.

## Verification

    npm.cmd test
    npm.cmd run build

Twenty-eight tests cover the original tests plus registration, cancellation, role checks, event ownership, validation, and search/filter behavior, along with:

- **Seat integrity** (`tests/seats-registrations.test.ts`): seats are derived from confirmed registrations only, stay consistent through register/cancel/re-register, never exceed capacity under burst registrations, and are repaired automatically on startup (`repairDataIntegrity` in `data/store.ts` collapses duplicate confirmed registrations and resyncs seat caches).
- **Visibility**: cancelled events are hidden from students and guests at the data layer (`eventsVisibleTo`/`studentFacingEvents`) while remaining visible to the owning organizer, whose dashboard has an Active / Cancelled & past tab with participant history.
- **Campus AI** (`tests/assistant.test.ts`): `askAssistant` in `data/assistant.ts` answers from live store data (events, seats, your registrations, recent additions/updates), respects the same visibility rules as the site, and never exposes other students' data. No event facts are hard-coded.

## Replacing files in an existing copy

Replace:
- app/page.tsx
- app/events/page.tsx
- app/events/[id]/page.tsx
- app/registrations/page.tsx
- app/organizer/page.tsx
- app/globals.css
- components/AuthProvider.tsx
- components/Navbar.tsx
- data/events.ts
- vitest.config.ts

Add:
- components/useStore.ts
- data/store.ts
- tests/features.test.ts

Keep all other original files, including data/registrations.ts.

## UI update

Forest-green, cream, and lime visual theme; responsive homepage with live counts and featured event; category shortcuts; illustrated event cards with availability indicators; sorting by date, free seats, or popularity; accessible navigation, form labels, keyboard focus and reduced-motion support. No external fonts or image downloads required.
