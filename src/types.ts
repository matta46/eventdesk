export type Role = 'organiser' | 'attendee';

export type Category = 'Workshop' | 'Networking' | 'Conference' | 'Social' | 'Training';

export const CATEGORIES: Category[] = ['Workshop', 'Networking', 'Conference', 'Social', 'Training'];

export const DIETARY = ['None', 'Vegetarian', 'Vegan', 'Gluten free', 'Halal', 'Other'] as const;
export type Dietary = (typeof DIETARY)[number];

export interface Attendee {
  id: string;
  name: string;
  email: string;
  organisation: string;
  dietary: Dietary;
  note: string; // anything the attendee wants the organiser to know
  checkedIn: boolean;
  registeredAt: string; // ISO timestamp
}

export interface AgendaItem {
  time: string; // HH:MM
  item: string;
}

export interface Host {
  name: string;
  role: string;
}

export interface EventItem {
  id: string;
  title: string;
  category: Category;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  venue: string;
  address: string;
  capacity: number;
  description: string;
  host: Host;
  agenda: AgendaItem[];
  whatToBring: string[];
  accessibility: string;
  attendees: Attendee[];
  waitlist: Attendee[];
}

export type EventStatus = 'past' | 'full' | 'filling' | 'open';

export type ActivityKind = 'registered' | 'cancelled' | 'waitlisted' | 'promoted' | 'checked-in' | 'created' | 'updated';

export interface Activity {
  id: string;
  at: string; // ISO timestamp
  kind: ActivityKind;
  eventId: string;
  eventTitle: string;
  person?: string;
}

/** Fields the organiser fills in on the create/edit form. */
export interface EventDraft {
  title: string;
  category: Category;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  address: string;
  capacity: string; // kept as text while editing, validated on save
  description: string;
  hostName: string;
  hostRole: string;
  agenda: string; // one item per line, e.g. "09:30 Welcome and coffee"
  whatToBring: string; // one item per line
  accessibility: string;
}

export type FieldErrors = Partial<Record<keyof EventDraft, string>>;
