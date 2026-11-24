import { describe, expect, it } from 'vitest';
import {
  addDays, attendeesToCsv, cancelAttendee, dietarySummary, eventStatus, fillFromWaitlist, isValidEmail,
  parseAgenda, registerAttendee, relativeDay, reminderMessage, summarise, validateDraft,
} from './logic';
import type { Attendee, EventDraft, EventItem } from './types';

const TODAY = '2026-12-01';

function attendee(i: number, overrides: Partial<Attendee> = {}): Attendee {
  return {
    id: `a${i}`, name: `Person ${i}`, email: `p${i}@example.com`, organisation: '', dietary: 'None',
    note: '', checkedIn: false, registeredAt: '2026-11-20T10:00:00.000Z', ...overrides,
  };
}

const people = (n: number, checkedIn = 0): Attendee[] =>
  Array.from({ length: n }, (_, i) => attendee(i, { checkedIn: i < checkedIn }));

function event(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: 'e1', title: 'Test event', category: 'Workshop', date: '2026-12-10', startTime: '09:00', endTime: '11:00',
    venue: 'Perth', address: '', capacity: 10, description: '', host: { name: 'Aryan Matta', role: 'Host' },
    agenda: [], whatToBring: [], accessibility: '', attendees: [], waitlist: [], ...overrides,
  };
}

const goodDraft: EventDraft = {
  title: 'Safety briefing', category: 'Training', date: '2026-12-05', startTime: '07:00', endTime: '09:00',
  venue: 'Kewdale', address: '', capacity: '15', description: 'Prestart checks', hostName: 'Leo Martin',
  hostRole: '', agenda: '07:00 Toolbox talk\n08:00 Walkthrough', whatToBring: '', accessibility: '',
};

describe('dates', () => {
  it('addDays moves across month ends in both directions', () => {
    expect(addDays('2026-11-29', 3)).toBe('2026-12-02');
    expect(addDays('2026-12-01', -1)).toBe('2026-11-30');
  });
  it('relativeDay describes dates in plain language', () => {
    expect(relativeDay('2026-12-01', TODAY)).toBe('Today');
    expect(relativeDay('2026-12-02', TODAY)).toBe('Tomorrow');
    expect(relativeDay('2026-12-06', TODAY)).toBe('In 5 days');
    expect(relativeDay('2026-11-28', TODAY)).toBe('3 days ago');
  });
});

describe('eventStatus', () => {
  it('marks past, full, filling and open events', () => {
    expect(eventStatus(event({ date: '2026-11-30' }), TODAY)).toBe('past');
    expect(eventStatus(event({ attendees: people(10) }), TODAY)).toBe('full');
    expect(eventStatus(event({ attendees: people(8) }), TODAY)).toBe('filling');
    expect(eventStatus(event({ attendees: people(3) }), TODAY)).toBe('open');
  });
});

describe('validateDraft', () => {
  it('accepts a valid new event', () => {
    expect(validateDraft(goodDraft, null, TODAY)).toEqual({});
  });
  it('rejects a short title and a missing host', () => {
    const errors = validateDraft({ ...goodDraft, title: 'Hi', hostName: '' }, null, TODAY);
    expect(errors.title).toBeDefined();
    expect(errors.hostName).toBeDefined();
  });
  it('rejects a new event in the past but allows editing a past one', () => {
    expect(validateDraft({ ...goodDraft, date: '2026-11-01' }, null, TODAY).date).toBeDefined();
    expect(validateDraft({ ...goodDraft, date: '2026-11-01' }, event({ date: '2026-11-01' }), TODAY).date).toBeUndefined();
  });
  it('rejects a finish time that is not after the start time', () => {
    expect(validateDraft({ ...goodDraft, endTime: '07:00' }, null, TODAY).endTime).toBeDefined();
  });
  it('rejects invalid capacities', () => {
    for (const capacity of ['abc', '0', '2.5', '-3', '5001']) {
      expect(validateDraft({ ...goodDraft, capacity }, null, TODAY).capacity).toBeDefined();
    }
  });
  it('rejects capacity below the number already registered', () => {
    const existing = event({ attendees: people(12), capacity: 20 });
    expect(validateDraft({ ...goodDraft, capacity: '5' }, existing, TODAY).capacity).toContain('12 people are already registered');
  });
  it('rejects agenda lines without a time', () => {
    expect(validateDraft({ ...goodDraft, agenda: '09:00 Welcome\nLunch' }, null, TODAY).agenda).toContain('Lunch');
  });
});

describe('parseAgenda', () => {
  it('parses, pads and sorts agenda lines', () => {
    const { items, invalid } = parseAgenda('10:30 Break\n9:00 Welcome\n\n');
    expect(invalid).toEqual([]);
    expect(items).toEqual([{ time: '09:00', item: 'Welcome' }, { time: '10:30', item: 'Break' }]);
  });
  it('flags lines with impossible times', () => {
    expect(parseAgenda('25:00 Too late').invalid).toEqual(['25:00 Too late']);
  });
});

describe('registration and waitlist', () => {
  it('registers someone when seats are free', () => {
    const { event: next, outcome } = registerAttendee(event({ capacity: 2 }), attendee(1));
    expect(outcome).toBe('registered');
    expect(next.attendees).toHaveLength(1);
  });
  it('puts people on the waitlist when the event is full', () => {
    const { event: next, outcome } = registerAttendee(event({ capacity: 2, attendees: people(2) }), attendee(9));
    expect(outcome).toBe('waitlisted');
    expect(next.waitlist.map((a) => a.id)).toEqual(['a9']);
  });
  it('promotes the first person on the waitlist when someone cancels', () => {
    const full = event({ capacity: 2, attendees: people(2), waitlist: [attendee(8), attendee(9)] });
    const { event: next, promoted } = cancelAttendee(full, 'a0');
    expect(promoted?.id).toBe('a8');
    expect(next.attendees.map((a) => a.id)).toEqual(['a1', 'a8']);
    expect(next.waitlist.map((a) => a.id)).toEqual(['a9']);
  });
  it('does not promote anyone when a waitlisted person leaves', () => {
    const full = event({ capacity: 2, attendees: people(2), waitlist: [attendee(8)] });
    const { event: next, promoted } = cancelAttendee(full, 'a8');
    expect(promoted).toBeNull();
    expect(next.waitlist).toHaveLength(0);
    expect(next.attendees).toHaveLength(2);
  });
  it('fills new seats from the waitlist when capacity grows', () => {
    const e = event({ capacity: 4, attendees: people(2), waitlist: [attendee(7), attendee(8), attendee(9)] });
    const { event: next, promoted } = fillFromWaitlist(e);
    expect(promoted.map((a) => a.id)).toEqual(['a7', 'a8']);
    expect(next.waitlist.map((a) => a.id)).toEqual(['a9']);
  });
});

describe('isValidEmail', () => {
  it('accepts normal addresses and rejects malformed ones', () => {
    expect(isValidEmail('name@company.com')).toBe(true);
    for (const bad of ['abc', 'abc@', '@company.com', 'a b@c.com']) expect(isValidEmail(bad)).toBe(false);
  });
});

describe('summaries', () => {
  it('counts upcoming events, registrations, fill rate, check-ins and waitlists', () => {
    const events = [
      event({ id: 'a', capacity: 10, attendees: people(5), date: '2026-12-20' }),
      event({ id: 'b', capacity: 10, attendees: people(10), waitlist: [attendee(20)], date: '2026-12-03' }),
      event({ id: 'c', date: '2026-11-01', capacity: 10, attendees: people(4, 3) }),
    ];
    const s = summarise(events, TODAY);
    expect(s.upcoming).toBe(2);
    expect(s.registrations).toBe(19);
    expect(s.fillRate).toBeCloseTo(0.75);
    expect(s.checkedIn).toBe(3);
    expect(s.waitlisted).toBe(1);
    expect(s.nextEvent?.id).toBe('b');
  });
  it('summarises dietary needs, ignoring "None"', () => {
    const e = event({ attendees: [attendee(1, { dietary: 'Vegan' }), attendee(2, { dietary: 'Vegan' }), attendee(3, { dietary: 'Halal' }), attendee(4)] });
    expect(dietarySummary(e)).toEqual([{ label: 'Vegan', count: 2 }, { label: 'Halal', count: 1 }]);
  });
});

describe('exports', () => {
  it('writes CSV with a header row and escaped quotes', () => {
    const csv = attendeesToCsv(event({ attendees: [attendee(1, { name: 'Sam "Sparky" Lee', email: 's@x.com', checkedIn: true, registeredAt: '2026-11-20T10:00:00Z' })] }));
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Name,Email,Organisation,Dietary,Checked in,Registered');
    expect(lines[1]).toBe('"Sam ""Sparky"" Lee","s@x.com","","None","Yes","2026-11-20"');
  });
  it('builds a reminder that mentions the venue and what to bring', () => {
    const msg = reminderMessage(event({ venue: 'Spacecubed', whatToBring: ['Laptop'] }));
    expect(msg).toContain('Spacecubed');
    expect(msg).toContain('Please bring: Laptop.');
    expect(msg.trim().endsWith('Aryan Matta')).toBe(true);
  });
});
