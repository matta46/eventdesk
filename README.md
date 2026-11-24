# EventDesk

A small event management web app built with **React 18 and TypeScript** (Vite).
Organisers create and manage events, track registrations and check people in;
attendees browse events and register.

## Features

- **Two roles:** Organiser and Attendee views with different permissions (only organisers can create, edit, delete or check people in), with a personalised greeting for each.
- **Rich event pages:** host, agenda timeline, what to bring, accessibility info, address with a Google Maps link, and friendly dates like "In 3 days".
- **Waitlists:** when an event is full, people join a waitlist. If someone cancels or capacity grows, the next person is moved in automatically.
- **Organiser overview:** next event, recent activity feed, catering summary from dietary requirements, and attendee notes.
- **Reminder message:** copy a ready-made reminder email for an event.
- **Event management:** create and edit events through a validated form (title, category, date, time, venue, capacity, description). New events can't be scheduled in the past, and capacity can't drop below current registrations.
- **Registrations:** attendees register with name, email, organisation, dietary needs and a note for the host (validated, no duplicate emails) and can cancel.
- **Check-in:** organisers check attendees in on the day of the event and see live check-in counts.
- **Search and filters:** by text, category and upcoming / past.
- **Summary:** upcoming events, total registrations, seat fill rate and check-ins.
- **Export:** copy an event's attendee list as CSV for Excel.
- **Persistence:** data is saved to the browser's localStorage (with safe fallbacks if storage is unavailable).
- Responsive layout (desktop and phone) with light and dark themes.

## Project structure

```
src/
  types.ts   Data types: events, attendees, roles, form drafts
  logic.ts   Pure functions: validation, event status, summaries, CSV export, date formatting
  logic.test.ts  Unit tests for logic.ts (Vitest)
  seed.ts    Fictional example events so the app opens in a working state
  App.tsx    UI components: event list, detail panel, registration, check-in, event form
  styles.css Theme tokens and layout
```

Business rules live in `logic.ts` as pure functions, separate from the UI, so they're easy to test and reuse.

## Run locally

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check and build to dist/index.html
npm test         # run the unit tests (Vitest)
```

## Tests

`src/logic.test.ts` has 22 unit tests covering form validation, agenda parsing, registration and waitlist promotion, summaries, email checks, CSV export and reminder messages.

## How it was built

Built with the help of AI coding tools (Claude). I defined the features and rules, reviewed and tested the generated code, and fixed and refined it before publishing.
