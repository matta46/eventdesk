import type { Activity, Attendee, Dietary, EventItem } from './types';
import { addDays, todayISO, uid } from './logic';

// Example data only: fictional events, people and organisations so the app opens in a working state.
const PEOPLE: { name: string; org: string; dietary: Dietary; note?: string }[] = [
  { name: 'Mia Chen', org: 'Harbour Analytics', dietary: 'Vegetarian' },
  { name: 'Liam Walsh', org: 'Walsh Electrical', dietary: 'None' },
  { name: 'Priya Nair', org: 'Swan River Health', dietary: 'Vegan', note: 'Arriving 10 minutes late, coming from a school drop-off.' },
  { name: 'Noah Ford', org: 'Ford Drilling Services', dietary: 'None' },
  { name: 'Ava Rossi', org: 'Rossi & Co Accountants', dietary: 'Gluten free' },
  { name: 'Ethan Kaur', org: 'Pilbara Mining Supplies', dietary: 'Halal' },
  { name: 'Zara Ahmed', org: 'Freelance designer', dietary: 'None' },
  { name: 'Jack Lee', org: 'Lee Logistics', dietary: 'None', note: 'I use a wheelchair, so a ground-floor seat would help.' },
  { name: 'Chloe Tran', org: 'City of Stirling', dietary: 'Vegetarian' },
  { name: 'Oliver Grant', org: 'Grant Civil', dietary: 'None' },
  { name: 'Isla Murphy', org: 'Murphy Bakehouse', dietary: 'Gluten free' },
  { name: 'Lucas Diaz', org: 'Northline Freight', dietary: 'None' },
  { name: 'Ruby Patel', org: 'Patel Pharmacy', dietary: 'Vegetarian' },
  { name: 'Harry Kim', org: 'Kim Software', dietary: 'None' },
  { name: 'Grace Wong', org: 'Wong Architects', dietary: 'Vegan' },
  { name: 'Leo Martin', org: 'Martin Earthmoving', dietary: 'None' },
  { name: 'Amelia Shaw', org: 'Shaw Physiotherapy', dietary: 'None' },
  { name: 'Sam Brooks', org: 'Brooks Plumbing', dietary: 'None' },
  { name: 'Hannah Ali', org: 'UWA student', dietary: 'Halal' },
  { name: 'Tom Nguyen', org: 'Nguyen IT Services', dietary: 'None' },
];

function person(i: number, hoursAgo: number, checkedIn = false): Attendee {
  const p = PEOPLE[i % PEOPLE.length];
  return {
    id: uid(),
    name: p.name,
    email: `${p.name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
    organisation: p.org,
    dietary: p.dietary,
    note: p.note ?? '',
    checkedIn,
    registeredAt: new Date(Date.now() - hoursAgo * 36e5).toISOString(),
  };
}

const range = (from: number, count: number, checkedIn = 0) =>
  Array.from({ length: count }, (_, k) => person(from + k, (count - k) * 7 + 2, k < checkedIn));

export function seedEvents(): EventItem[] {
  const t = todayISO();
  return [
    {
      id: uid(), title: 'Intro to Power BI for Small Business', category: 'Workshop',
      date: addDays(t, 3), startTime: '09:30', endTime: '12:30',
      venue: 'State Library of WA, Learning Room 2', address: '25 Francis St, Perth WA 6000', capacity: 20,
      description: 'Turn the spreadsheet you already use into a dashboard you’ll actually look at. We’ll start from a real sales file, clean it up together and build a one-page report you can take back to work on Monday. No experience needed, just curiosity.',
      host: { name: 'Aryan Matta', role: 'Workshop lead' },
      agenda: [
        { time: '09:30', item: 'Coffee and introductions' },
        { time: '09:45', item: 'From spreadsheet to data model' },
        { time: '10:45', item: 'Break' },
        { time: '11:00', item: 'Building your first dashboard' },
        { time: '12:00', item: 'Questions and next steps' },
      ],
      whatToBring: ['A laptop with Power BI Desktop installed (free)', 'A spreadsheet from your business, if you have one'],
      accessibility: 'Lift access to all floors. Accessible toilets on level 2.',
      attendees: range(0, 16), waitlist: [],
    },
    {
      id: uid(), title: 'Perth Tech Meetup: AI in the Field', category: 'Networking',
      date: addDays(t, 6), startTime: '17:30', endTime: '20:00',
      venue: 'Spacecubed', address: '45 St Georges Tce, Perth WA 6000', capacity: 12,
      description: 'Three short talks from people using AI tools on mine sites, in field service and on the tools, followed by drinks and a chat. Bring your questions, and your best story about technology going wrong on site.',
      host: { name: 'Chloe Tran', role: 'Meetup organiser' },
      agenda: [
        { time: '17:30', item: 'Arrivals and drinks' },
        { time: '18:00', item: 'Talks: AI on site, in practice' },
        { time: '19:00', item: 'Panel Q&A' },
        { time: '19:20', item: 'Networking' },
      ],
      whatToBring: ['Business cards, if you still have them'],
      accessibility: 'Step-free entry from St Georges Tce.',
      attendees: range(2, 12), waitlist: [person(16, 3), person(17, 1)],
    },
    {
      id: uid(), title: 'Site Safety Refresher', category: 'Training',
      date: addDays(t, 10), startTime: '07:00', endTime: '11:00',
      venue: 'Kewdale Training Centre', address: '12 Kewdale Rd, Kewdale WA 6105', capacity: 15,
      description: 'A practical morning covering prestart checks, hazard reporting and incident forms. Required for all new crew members before their first rotation, and a good refresher for everyone else.',
      host: { name: 'Leo Martin', role: 'Safety coordinator' },
      agenda: [
        { time: '07:00', item: 'Sign-in and toolbox talk' },
        { time: '07:30', item: 'Prestart checks walkthrough' },
        { time: '09:00', item: 'Smoko' },
        { time: '09:20', item: 'Hazard and incident reporting' },
        { time: '10:30', item: 'Short quiz and sign-off' },
      ],
      whatToBring: ['Steel-capped boots', 'Hi-vis shirt', 'Photo ID'],
      accessibility: 'Ground-floor training room with parking at the door.',
      attendees: range(5, 5), waitlist: [],
    },
    {
      id: uid(), title: 'WA Data & Analytics Conference', category: 'Conference',
      date: addDays(t, 21), startTime: '08:45', endTime: '17:00',
      venue: 'Perth Convention and Exhibition Centre', address: '21 Mounts Bay Rd, Perth WA 6000', capacity: 18,
      description: 'A full day of talks on data platforms, reporting and analytics from people doing the work across WA. Morning tea, lunch and afternoon tea are included, so let us know your dietary needs when you register.',
      host: { name: 'Grace Wong', role: 'Conference chair' },
      agenda: [
        { time: '08:45', item: 'Registration and coffee' },
        { time: '09:15', item: 'Keynote: Data in the resources sector' },
        { time: '12:30', item: 'Lunch' },
        { time: '13:30', item: 'Breakout sessions' },
        { time: '16:30', item: 'Closing and drinks' },
      ],
      whatToBring: ['Your registration email'],
      accessibility: 'Fully accessible venue. Hearing loop available in the main hall.',
      attendees: range(8, 7), waitlist: [],
    },
    {
      id: uid(), title: 'End-of-Year Team Sundowner', category: 'Social',
      date: addDays(t, -4), startTime: '16:00', endTime: '19:00',
      venue: 'Fremantle Esplanade Reserve', address: 'Marine Tce, Fremantle WA 6160', capacity: 18,
      description: 'Casual drinks, a sausage sizzle and a few thank-yous to wrap up a big year.',
      host: { name: 'Mia Chen', role: 'Social club' },
      agenda: [{ time: '16:00', item: 'Drinks and food' }, { time: '17:30', item: 'Thank-yous' }],
      whatToBring: ['A hat and sunscreen'],
      accessibility: 'Flat grassed area with nearby accessible toilets.',
      attendees: range(0, 14, 11), waitlist: [],
    },
  ];
}

/** A few recent activity items so the organiser's feed isn't empty on first load. */
export function seedActivity(events: EventItem[]): Activity[] {
  const items: Activity[] = [];
  const add = (e: EventItem | undefined, kind: Activity['kind'], minsAgo: number, person?: string) => {
    if (!e) return;
    items.push({ id: uid(), at: new Date(Date.now() - minsAgo * 60_000).toISOString(), kind, eventId: e.id, eventTitle: e.title, person });
  };
  add(events[1], 'waitlisted', 58, events[1]?.waitlist[1]?.name);
  add(events[0], 'registered', 140, events[0]?.attendees[15]?.name);
  add(events[3], 'registered', 260, events[3]?.attendees[6]?.name);
  add(events[2], 'registered', 400, events[2]?.attendees[4]?.name);
  return items;
}
