import type { AgendaItem, Attendee, EventDraft, EventItem, EventStatus, FieldErrors } from './types';

export const uid = (): string =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Today's date as YYYY-MM-DD in the viewer's local time. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Shift a YYYY-MM-DD date by a number of days. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return todayISO(new Date(y, m - 1, d + days));
}

/** Whole days from `today` to `iso` (negative if in the past). */
export function daysBetween(today: string, iso: string): number {
  const toUTC = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUTC(iso) - toUTC(today)) / 86_400_000);
}

/** Friendly description of when an event is, e.g. "Tomorrow" or "In 5 days". */
export function relativeDay(iso: string, today: string = todayISO()): string {
  const n = daysBetween(today, iso);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 14) return `In ${n} days`;
  if (n >= 14) return `In ${Math.round(n / 7)} weeks`;
  if (n > -14) return `${-n} days ago`;
  return `${Math.round(-n / 7)} weeks ago`;
}

/** Friendly "time ago" text for activity, e.g. "5 min ago". */
export function timeAgo(isoTimestamp: string, now: Date = new Date()): string {
  const mins = Math.round((now.getTime() - new Date(isoTimestamp).getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function eventStatus(e: EventItem, today: string = todayISO()): EventStatus {
  if (e.date < today) return 'past';
  const ratio = e.attendees.length / e.capacity;
  if (ratio >= 1) return 'full';
  if (ratio >= 0.75) return 'filling';
  return 'open';
}

export const STATUS_LABEL: Record<EventStatus, string> = {
  past: 'Finished',
  full: 'Full',
  filling: 'Filling fast',
  open: 'Open',
};

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function shortDateParts(iso: string): { dow: string; day: number; mon: string } {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    dow: dt.toLocaleDateString('en-AU', { weekday: 'short' }),
    day: d,
    mon: dt.toLocaleDateString('en-AU', { month: 'short' }),
  };
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

export const initials = (name: string): string =>
  name.trim().split(/\s+/).map((p) => p[0]?.toUpperCase() ?? '').join('').slice(0, 2);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (email: string): boolean => EMAIL_RE.test(email.trim());

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Turns the organiser's agenda text (one item per line, starting with a time)
 * into agenda items. Lines without a valid time are returned in `invalid`.
 */
export function parseAgenda(text: string): { items: AgendaItem[]; invalid: string[] } {
  const items: AgendaItem[] = [];
  const invalid: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(/^(\d{1,2}):(\d{2})\s+(.+)$/);
    const time = match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
    if (match && TIME_RE.test(time)) items.push({ time, item: match[3].trim() });
    else invalid.push(line);
  }
  items.sort((a, b) => a.time.localeCompare(b.time));
  return { items, invalid };
}

export const agendaToText = (agenda: AgendaItem[]): string =>
  agenda.map((a) => `${a.time} ${a.item}`).join('\n');

export const linesToList = (text: string): string[] =>
  text.split('\n').map((l) => l.trim()).filter(Boolean);

/**
 * Validates the organiser's form. Returns an empty object when the draft is valid.
 * `existing` is the event being edited, so capacity can't drop below current registrations.
 */
export function validateDraft(
  draft: EventDraft,
  existing: EventItem | null,
  today: string = todayISO(),
): FieldErrors {
  const errors: FieldErrors = {};
  if (draft.title.trim().length < 3) errors.title = 'Give the event a title of at least 3 characters.';
  if (!draft.date) errors.date = 'Choose a date.';
  else if (!existing && draft.date < today) errors.date = 'New events need to be today or later.';
  if (!draft.startTime) errors.startTime = 'Choose a start time.';
  if (!draft.endTime) errors.endTime = 'Choose a finish time.';
  else if (draft.startTime && draft.endTime <= draft.startTime) errors.endTime = 'The finish time needs to be after the start time.';
  if (draft.venue.trim().length < 2) errors.venue = 'Add the venue name.';
  const cap = Number(draft.capacity);
  if (!Number.isInteger(cap) || cap < 1) errors.capacity = 'Capacity must be a whole number of 1 or more.';
  else if (cap > 5000) errors.capacity = 'Capacity can be at most 5,000.';
  else if (existing && cap < existing.attendees.length)
    errors.capacity = `${existing.attendees.length} people are already registered, so capacity can't go below that.`;
  if (draft.description.trim().length > 600) errors.description = 'Keep the description under 600 characters.';
  if (draft.hostName.trim().length < 2) errors.hostName = 'Add the name of the host or contact person.';
  const { invalid } = parseAgenda(draft.agenda);
  if (invalid.length) errors.agenda = `Start each agenda line with a time, like "09:30 Welcome". Check: "${invalid[0]}".`;
  return errors;
}

export type RegisterResult = { event: EventItem; outcome: 'registered' | 'waitlisted' };

/** Registers someone, or adds them to the waitlist if the event is full. */
export function registerAttendee(e: EventItem, person: Attendee): RegisterResult {
  if (e.attendees.length < e.capacity) {
    return { event: { ...e, attendees: [...e.attendees, person] }, outcome: 'registered' };
  }
  return { event: { ...e, waitlist: [...e.waitlist, person] }, outcome: 'waitlisted' };
}

/**
 * Removes someone from the event (or its waitlist). When a confirmed seat frees up,
 * the first person on the waitlist is promoted into it.
 */
export function cancelAttendee(e: EventItem, attendeeId: string): { event: EventItem; promoted: Attendee | null } {
  if (e.waitlist.some((a) => a.id === attendeeId)) {
    return { event: { ...e, waitlist: e.waitlist.filter((a) => a.id !== attendeeId) }, promoted: null };
  }
  const attendees = e.attendees.filter((a) => a.id !== attendeeId);
  if (attendees.length < e.capacity && e.waitlist.length > 0) {
    const [promoted, ...rest] = e.waitlist;
    return { event: { ...e, attendees: [...attendees, promoted], waitlist: rest }, promoted };
  }
  return { event: { ...e, attendees }, promoted: null };
}

/** When capacity grows, moves people off the waitlist into the new seats (first come, first served). */
export function fillFromWaitlist(e: EventItem): { event: EventItem; promoted: Attendee[] } {
  const free = e.capacity - e.attendees.length;
  if (free <= 0 || e.waitlist.length === 0) return { event: e, promoted: [] };
  const promoted = e.waitlist.slice(0, free);
  return {
    event: { ...e, attendees: [...e.attendees, ...promoted], waitlist: e.waitlist.slice(free) },
    promoted,
  };
}

export interface Summary {
  upcoming: number;
  registrations: number;
  fillRate: number; // 0..1 across upcoming events
  checkedIn: number;
  waitlisted: number;
  nextEvent: EventItem | null;
}

export function summarise(events: EventItem[], today: string = todayISO()): Summary {
  const upcoming = events.filter((e) => e.date >= today);
  const seats = upcoming.reduce((n, e) => n + e.capacity, 0);
  const booked = upcoming.reduce((n, e) => n + e.attendees.length, 0);
  const next = [...upcoming].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))[0] ?? null;
  return {
    upcoming: upcoming.length,
    registrations: events.reduce((n, e) => n + e.attendees.length, 0),
    fillRate: seats === 0 ? 0 : booked / seats,
    checkedIn: events.reduce((n, e) => n + e.attendees.filter((a) => a.checkedIn).length, 0),
    waitlisted: upcoming.reduce((n, e) => n + e.waitlist.length, 0),
    nextEvent: next,
  };
}

/** Counts dietary requirements among confirmed attendees, ignoring "None". */
export function dietarySummary(e: EventItem): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const a of e.attendees) if (a.dietary !== 'None') counts.set(a.dietary, (counts.get(a.dietary) ?? 0) + 1);
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

/** Converts an event's attendee list to CSV text for copying into a spreadsheet. */
export function attendeesToCsv(e: EventItem): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = e.attendees.map((a) =>
    [a.name, a.email, a.organisation, a.dietary, a.checkedIn ? 'Yes' : 'No', a.registeredAt.slice(0, 10)].map(esc).join(','),
  );
  return ['Name,Email,Organisation,Dietary,Checked in,Registered', ...rows].join('\n');
}

/** A friendly reminder message the organiser can copy into an email or SMS. */
export function reminderMessage(e: EventItem): string {
  const lines = [
    `Hi everyone,`,
    ``,
    `A quick reminder that ${e.title} is on ${formatDate(e.date)}, ${formatTime(e.startTime)} to ${formatTime(e.endTime)}, at ${e.venue}${e.address ? ` (${e.address})` : ''}.`,
  ];
  if (e.whatToBring.length) lines.push('', `Please bring: ${e.whatToBring.join(', ')}.`);
  lines.push('', `If you can no longer make it, let us know so we can offer your spot to someone on the waitlist.`, '', `See you there,`, e.host.name);
  return lines.join('\n');
}
