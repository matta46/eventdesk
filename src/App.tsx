import { useEffect, useMemo, useState } from 'react';
import type { Activity, ActivityKind, Attendee, Category, Dietary, EventDraft, EventItem, EventStatus, FieldErrors, Role } from './types';
import { CATEGORIES, DIETARY } from './types';
import {
  STATUS_LABEL, agendaToText, attendeesToCsv, cancelAttendee, dietarySummary, eventStatus, fillFromWaitlist,
  firstName, formatDate, formatTime, greeting, initials, isValidEmail, linesToList, parseAgenda, registerAttendee,
  relativeDay, reminderMessage, shortDateParts, summarise, timeAgo, todayISO, uid, validateDraft,
} from './logic';
import { seedActivity, seedEvents } from './seed';

const STORAGE_KEY = 'eventdesk:v2';
const ORGANISER_NAME = 'Aryan';

interface Me { name: string; email: string; organisation: string; dietary: Dietary }
interface Stored { events: EventItem[]; activity: Activity[]; me: Me }

const blankMe: Me = { name: '', email: '', organisation: '', dietary: 'None' };

function load(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function save(data: Stored): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable (private window etc.): the app still works for this visit */
  }
}

const emptyDraft = (): EventDraft => ({
  title: '', category: 'Workshop', date: todayISO(), startTime: '09:00', endTime: '11:00', venue: '', address: '',
  capacity: '20', description: '', hostName: '', hostRole: '', agenda: '', whatToBring: '', accessibility: '',
});

const toDraft = (e: EventItem): EventDraft => ({
  title: e.title, category: e.category, date: e.date, startTime: e.startTime, endTime: e.endTime, venue: e.venue,
  address: e.address, capacity: String(e.capacity), description: e.description, hostName: e.host.name,
  hostRole: e.host.role, agenda: agendaToText(e.agenda), whatToBring: e.whatToBring.join('\n'), accessibility: e.accessibility,
});

type StatusFilter = 'all' | 'upcoming' | 'past';

const ACTIVITY_TEXT: Record<ActivityKind, string> = {
  registered: 'registered for',
  cancelled: 'cancelled their spot at',
  waitlisted: 'joined the waitlist for',
  promoted: 'moved off the waitlist into',
  'checked-in': 'checked in to',
  created: 'You created',
  updated: 'You updated',
};

export default function App() {
  const initial = useMemo(load, []);
  const [events, setEvents] = useState<EventItem[]>(() => initial?.events ?? seedEvents());
  const [activity, setActivity] = useState<Activity[]>(() => initial?.activity ?? seedActivity(events));
  const [me, setMe] = useState<Me>(initial?.me ?? blankMe);
  const [role, setRole] = useState<Role>('organiser');
  const [selectedId, setSelectedId] = useState<string | null>(events[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('upcoming');
  const [editing, setEditing] = useState<{ draft: EventDraft; id: string | null } | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => save({ events, activity, me }), [events, activity, me]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const today = todayISO();
  const summary = summarise(events, today);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((e) => (statusFilter === 'all' ? true : statusFilter === 'past' ? e.date < today : e.date >= today))
      .filter((e) => (category === 'all' ? true : e.category === category))
      .filter((e) => !q || `${e.title} ${e.venue} ${e.description} ${e.host.name}`.toLowerCase().includes(q))
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime) * (statusFilter === 'past' ? -1 : 1));
  }, [events, query, category, statusFilter, today]);

  const selected = events.find((e) => e.id === selectedId) ?? null;

  function log(kind: ActivityKind, e: EventItem, person?: string) {
    setActivity((all) => [{ id: uid(), at: new Date().toISOString(), kind, eventId: e.id, eventTitle: e.title, person }, ...all].slice(0, 30));
  }

  function replaceEvent(next: EventItem) {
    setEvents((all) => all.map((e) => (e.id === next.id ? next : e)));
  }

  function openCreate() {
    setErrors({});
    setEditing({ draft: { ...emptyDraft(), hostName: 'Aryan Matta', hostRole: 'Organiser' }, id: null });
  }

  function saveDraft() {
    if (!editing) return;
    const existing = editing.id ? events.find((e) => e.id === editing.id) ?? null : null;
    const errs = validateDraft(editing.draft, existing, today);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const d = editing.draft;
    const fields = {
      title: d.title.trim(), category: d.category, date: d.date, startTime: d.startTime, endTime: d.endTime,
      venue: d.venue.trim(), address: d.address.trim(), capacity: Number(d.capacity), description: d.description.trim(),
      host: { name: d.hostName.trim(), role: d.hostRole.trim() }, agenda: parseAgenda(d.agenda).items,
      whatToBring: linesToList(d.whatToBring), accessibility: d.accessibility.trim(),
    };
    if (existing) {
      const { event: next, promoted } = fillFromWaitlist({ ...existing, ...fields });
      replaceEvent(next);
      log('updated', next);
      promoted.forEach((p) => log('promoted', next, p.name));
      setToast(promoted.length ? `Saved. ${promoted.length} ${promoted.length === 1 ? 'person' : 'people'} moved off the waitlist.` : 'Changes saved');
    } else {
      const created: EventItem = { id: uid(), attendees: [], waitlist: [], ...fields };
      setEvents((all) => [...all, created]);
      setSelectedId(created.id);
      setStatusFilter(created.date < today ? 'past' : 'upcoming');
      log('created', created);
      setToast('Event created. Switch to the Attendee view to see how it looks.');
    }
    setEditing(null);
  }

  function deleteSelected() {
    if (!selected) return;
    setEvents((all) => all.filter((e) => e.id !== selected.id));
    setActivity((all) => all.filter((a) => a.eventId !== selected.id));
    setSelectedId(null);
    setConfirmDelete(false);
    setToast(`“${selected.title}” deleted`);
  }

  function resetDemo() {
    const fresh = seedEvents();
    setEvents(fresh);
    setActivity(seedActivity(fresh));
    setSelectedId(fresh[0].id);
    setConfirmReset(false);
    setStatusFilter('upcoming');
    setToast('Example data restored');
  }

  const meName = me.name ? firstName(me.name) : '';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">ED</span>
          <div>
            <h1>EventDesk</h1>
            <p className="sub">
              {role === 'organiser'
                ? `${greeting()}, ${ORGANISER_NAME}. Here’s what’s coming up.`
                : `${greeting()}${meName ? `, ${meName}` : ''}. Find something worth showing up for.`}
            </p>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="segmented" role="group" aria-label="View as">
            {(['organiser', 'attendee'] as Role[]).map((r) => (
              <button key={r} type="button" className={role === r ? 'on' : ''} aria-pressed={role === r} onClick={() => { setRole(r); setConfirmDelete(false); }}>
                {r === 'organiser' ? 'Organiser' : 'Attendee'}
              </button>
            ))}
          </div>
          {role === 'organiser' && <button type="button" className="btn primary" onClick={openCreate}>New event</button>}
        </div>
      </header>

      {role === 'organiser' && (
        <section className="overview" aria-label="Overview">
          <div className="stats">
            <Stat label="Upcoming events" value={String(summary.upcoming)} />
            <Stat label="People registered" value={String(summary.registrations)} />
            <Stat label="Seats filled" value={`${Math.round(summary.fillRate * 100)}%`} hint="across upcoming events" />
            <Stat label="On waitlists" value={String(summary.waitlisted)} />
          </div>
          <div className="overview-row">
            {summary.nextEvent && (
              <button type="button" className="next-up" onClick={() => { setSelectedId(summary.nextEvent!.id); setStatusFilter('upcoming'); }}>
                <span className="eyebrow">Next up · {relativeDay(summary.nextEvent.date, today)}</span>
                <strong>{summary.nextEvent.title}</strong>
                <span className="muted">
                  {formatTime(summary.nextEvent.startTime)} at {summary.nextEvent.venue} · {summary.nextEvent.capacity - summary.nextEvent.attendees.length} seats left
                </span>
              </button>
            )}
            <div className="activity">
              <h2 className="eyebrow">Recent activity</h2>
              {activity.length === 0 ? (
                <p className="muted">Nothing yet. Registrations and check-ins will show up here.</p>
              ) : (
                <ul>
                  {activity.slice(0, 4).map((a) => (
                    <li key={a.id}>
                      <span className={`dot ${a.kind}`} aria-hidden="true" />
                      <span className="activity-text">
                        {a.person ? <strong>{a.person}</strong> : null} {ACTIVITY_TEXT[a.kind]}{' '}
                        <button type="button" className="linklike" onClick={() => setSelectedId(a.eventId)}>{a.eventTitle}</button>
                      </span>
                      <time className="muted">{timeAgo(a.at)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="toolbar" aria-label="Filters">
        <label className="field grow">
          <span className="sr">Search events</span>
          <input id="search" type="search" placeholder="Search events, venues or hosts" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="field">
          <span className="sr">Category</span>
          <select id="category-filter" value={category} onChange={(e) => setCategory(e.target.value as Category | 'all')}>
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <div className="segmented small" role="group" aria-label="Show">
          {(['upcoming', 'past', 'all'] as StatusFilter[]).map((s) => (
            <button key={s} type="button" className={statusFilter === s ? 'on' : ''} aria-pressed={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </section>

      <main className="layout">
        <section className="list" aria-label="Events">
          {visible.length === 0 ? (
            <div className="empty">
              <p><strong>Nothing here yet.</strong></p>
              <p className="muted">{query ? `No events match “${query}”. Try a different word or clear the filters.` : 'No events match these filters.'}</p>
              {role === 'organiser' && <button type="button" className="btn" onClick={openCreate}>Create an event</button>}
            </div>
          ) : (
            visible.map((e) => (
              <EventCard key={e.id} event={e} today={today} status={eventStatus(e, today)} active={e.id === selectedId}
                mine={!!me.email && e.attendees.some((a) => a.email.toLowerCase() === me.email.toLowerCase())}
                onSelect={() => { setSelectedId(e.id); setConfirmDelete(false); }} />
            ))
          )}
        </section>

        <section className="detail" aria-label="Event details">
          {selected ? (
            <Detail
              key={selected.id + role}
              event={selected}
              today={today}
              status={eventStatus(selected, today)}
              role={role}
              me={me}
              setMe={setMe}
              confirmDelete={confirmDelete}
              setConfirmDelete={setConfirmDelete}
              onEdit={() => { setErrors({}); setEditing({ draft: toDraft(selected), id: selected.id }); }}
              onDelete={deleteSelected}
              onReplace={replaceEvent}
              log={log}
              notify={setToast}
            />
          ) : (
            <div className="empty">
              <p><strong>Pick an event</strong></p>
              <p className="muted">{role === 'organiser' ? 'You’ll see who’s coming, dietary needs and check-ins here.' : 'You’ll see the agenda, what to bring and how to register here.'}</p>
            </div>
          )}
        </section>
      </main>

      <footer className="foot">
        <span>The events and people here are made-up examples. Your changes are saved in this browser only.</span>
        {confirmReset ? (
          <span className="inline-confirm">
            Replace everything with the example data?
            <button type="button" className="btn danger small" onClick={resetDemo}>Reset</button>
            <button type="button" className="btn small" onClick={() => setConfirmReset(false)}>Keep my changes</button>
          </span>
        ) : (
          <button type="button" className="linklike" onClick={() => setConfirmReset(true)}>Reset example data</button>
        )}
      </footer>

      {editing && (
        <EventForm draft={editing.draft} isNew={editing.id === null} errors={errors}
          onChange={(draft) => setEditing({ ...editing, draft })} onCancel={() => setEditing(null)} onSave={saveDraft} />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

function Capacity({ booked, capacity, waitlist }: { booked: number; capacity: number; waitlist: number }) {
  const pct = Math.min(100, Math.round((booked / capacity) * 100));
  return (
    <div className="capacity">
      <div className="bar" role="meter" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={booked} aria-label="Seats booked">
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className="capacity-text">
        {booked}/{capacity} going{waitlist ? ` · ${waitlist} waiting` : ''}
      </span>
    </div>
  );
}

function Faces({ people }: { people: Attendee[] }) {
  const shown = people.slice(0, 4);
  return (
    <span className="faces" aria-hidden="true">
      {shown.map((p) => <span key={p.id} className="face">{initials(p.name)}</span>)}
      {people.length > shown.length && <span className="face more">+{people.length - shown.length}</span>}
    </span>
  );
}

interface CardProps { event: EventItem; today: string; status: EventStatus; active: boolean; mine: boolean; onSelect: () => void }

function EventCard({ event, today, status, active, mine, onSelect }: CardProps) {
  const d = shortDateParts(event.date);
  return (
    <button type="button" className={`card ${active ? 'active' : ''} ${status}`} onClick={onSelect} aria-current={active}>
      <div className={`date-block cat-${event.category.toLowerCase()}`} aria-hidden="true">
        <span className="dow">{d.dow}</span>
        <span className="day">{d.day}</span>
        <span className="mon">{d.mon}</span>
      </div>
      <div className="card-body">
        <div className="card-top">
          <span className="cat">{event.category} · {relativeDay(event.date, today)}</span>
          <span className="pills">
            {mine && <span className="pill going">You’re going</span>}
            <span className={`pill ${status}`}>{STATUS_LABEL[status]}</span>
          </span>
        </div>
        <h3>{event.title}</h3>
        <p className="meta">{formatTime(event.startTime)}–{formatTime(event.endTime)} · {event.venue}</p>
        <div className="card-foot">
          <Faces people={event.attendees} />
          <Capacity booked={event.attendees.length} capacity={event.capacity} waitlist={event.waitlist.length} />
        </div>
      </div>
    </button>
  );
}

interface DetailProps {
  event: EventItem;
  today: string;
  status: EventStatus;
  role: Role;
  me: Me;
  setMe: (m: Me) => void;
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onReplace: (e: EventItem) => void;
  log: (kind: ActivityKind, e: EventItem, person?: string) => void;
  notify: (msg: string) => void;
}

function Detail(props: DetailProps) {
  const { event, today, status, role, confirmDelete, setConfirmDelete, onEdit, onDelete, notify } = props;
  const seatsLeft = event.capacity - event.attendees.length;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue} ${event.address}`)}`;

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify(done);
    } catch {
      notify('Copying isn’t available here. Try again from the full browser view.');
    }
  }

  return (
    <article className="detail-inner">
      <div className={`cover cat-${event.category.toLowerCase()}`}>
        <div className="card-top">
          <span className="cat">{event.category}</span>
          <span className={`pill ${status}`}>{STATUS_LABEL[status]}</span>
        </div>
        <h2>{event.title}</h2>
        <p className="cover-when">{formatDate(event.date)} · {formatTime(event.startTime)}–{formatTime(event.endTime)} <span>({relativeDay(event.date, today)})</span></p>
      </div>

      <dl className="facts">
        <div><dt>Where</dt><dd>{event.venue}{event.address && <><br /><span className="muted">{event.address}</span></>}<br /><a href={mapsUrl} target="_blank" rel="noreferrer">Open in Google Maps</a></dd></div>
        <div><dt>Seats</dt><dd>{status === 'past' ? `${event.attendees.length} people came along` : seatsLeft > 0 ? `${seatsLeft} of ${event.capacity} still available` : `Fully booked${event.waitlist.length ? `, ${event.waitlist.length} on the waitlist` : ''}`}</dd></div>
        <div><dt>Host</dt><dd className="host"><span className="face big" aria-hidden="true">{initials(event.host.name)}</span><span><strong>{event.host.name}</strong>{event.host.role && <span className="muted"> · {event.host.role}</span>}</span></dd></div>
      </dl>
      <Capacity booked={event.attendees.length} capacity={event.capacity} waitlist={event.waitlist.length} />

      {event.description && <p className="desc">{event.description}</p>}

      {event.agenda.length > 0 && (
        <section className="block">
          <h3>Agenda</h3>
          <ol className="agenda">
            {event.agenda.map((a) => (
              <li key={a.time + a.item}><time>{formatTime(a.time)}</time><span>{a.item}</span></li>
            ))}
          </ol>
        </section>
      )}

      {(event.whatToBring.length > 0 || event.accessibility) && (
        <section className="block two-col">
          {event.whatToBring.length > 0 && (
            <div>
              <h3>What to bring</h3>
              <ul className="ticks">{event.whatToBring.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          )}
          {event.accessibility && (
            <div>
              <h3>Accessibility</h3>
              <p className="muted">{event.accessibility}</p>
            </div>
          )}
        </section>
      )}

      {role === 'organiser' ? (
        <OrganiserPanel {...props} copy={copy} />
      ) : (
        <AttendeePanel {...props} />
      )}

      {role === 'organiser' && (
        <div className="actions danger-zone">
          <button type="button" className="btn" onClick={onEdit}>Edit event</button>
          {status !== 'past' && event.attendees.length > 0 && (
            <button type="button" className="btn" onClick={() => copy(reminderMessage(event), 'Reminder copied. Paste it into an email or SMS.')}>Copy reminder message</button>
          )}
          {confirmDelete ? (
            <span className="inline-confirm">
              Delete this event and its {event.attendees.length} registrations? This can’t be undone.
              <button type="button" className="btn danger small" onClick={onDelete}>Delete</button>
              <button type="button" className="btn small" onClick={() => setConfirmDelete(false)}>Keep it</button>
            </span>
          ) : (
            <button type="button" className="btn ghost-danger" onClick={() => setConfirmDelete(true)}>Delete event</button>
          )}
        </div>
      )}
    </article>
  );
}

function OrganiserPanel({ event, today, onReplace, log, notify, copy }: DetailProps & { copy: (t: string, done: string) => void }) {
  const [attendeeQuery, setAttendeeQuery] = useState('');
  const checkedIn = event.attendees.filter((a) => a.checkedIn).length;
  const canCheckIn = event.date <= today;
  const dietary = dietarySummary(event);
  const notes = event.attendees.filter((a) => a.note);

  function toggleCheckIn(a: Attendee) {
    const next = { ...event, attendees: event.attendees.map((x) => (x.id === a.id ? { ...x, checkedIn: !x.checkedIn } : x)) };
    onReplace(next);
    if (!a.checkedIn) log('checked-in', next, a.name);
  }

  function remove(a: Attendee) {
    const { event: next, promoted } = cancelAttendee(event, a.id);
    onReplace(next);
    log('cancelled', next, a.name);
    if (promoted) {
      log('promoted', next, promoted.name);
      notify(`${firstName(a.name)} removed. ${promoted.name} moved off the waitlist into their seat.`);
    } else notify(`${firstName(a.name)} removed`);
  }

  const filtered = event.attendees.filter((a) => `${a.name} ${a.email} ${a.organisation}`.toLowerCase().includes(attendeeQuery.trim().toLowerCase()));

  return (
    <section className="block">
      <div className="attendees-head">
        <h3>Who’s coming <span className="count">{event.attendees.length} registered{canCheckIn ? ` · ${checkedIn} checked in` : ''}</span></h3>
        <div className="attendees-tools">
          <input id="attendee-search" type="search" placeholder="Find someone" value={attendeeQuery} onChange={(e) => setAttendeeQuery(e.target.value)} aria-label="Find someone" />
          <button type="button" className="btn small" onClick={() => copy(attendeesToCsv(event), 'Attendee list copied. Paste it into Excel.')} disabled={event.attendees.length === 0}>Copy CSV</button>
        </div>
      </div>

      {(dietary.length > 0 || notes.length > 0) && (
        <div className="callouts">
          {dietary.length > 0 && (
            <p><strong>Catering:</strong> {dietary.map((d) => `${d.count} ${d.label.toLowerCase()}`).join(', ')}.</p>
          )}
          {notes.length > 0 && <p><strong>{notes.length} {notes.length === 1 ? 'note' : 'notes'} from attendees</strong>, shown under their names below.</p>}
        </div>
      )}

      {event.attendees.length === 0 ? (
        <p className="muted">No one has registered yet. Share the event and they’ll appear here.</p>
      ) : (
        <ul className="attendees">
          {filtered.map((a) => (
            <li key={a.id}>
              <div className="who">
                <span className="face big" aria-hidden="true">{initials(a.name)}</span>
                <div>
                  <span className="name">{a.name}{a.dietary !== 'None' && <span className="tag">{a.dietary}</span>}</span>
                  <span className="email">{a.organisation ? `${a.organisation} · ` : ''}{a.email}</span>
                  {a.note && <span className="note">“{a.note}”</span>}
                </div>
              </div>
              <div className="row-actions">
                <button type="button" className={`check ${a.checkedIn ? 'done' : ''}`} onClick={() => toggleCheckIn(a)} aria-pressed={a.checkedIn} disabled={!canCheckIn}>
                  {a.checkedIn ? 'Checked in' : 'Check in'}
                </button>
                {event.date >= today && <button type="button" className="icon-btn" onClick={() => remove(a)} aria-label={`Remove ${a.name}`} title="Remove">×</button>}
              </div>
            </li>
          ))}
          {filtered.length === 0 && <li className="muted">No one matches “{attendeeQuery}”.</li>}
        </ul>
      )}
      {!canCheckIn && event.attendees.length > 0 && <p className="hint">Check-in opens on the day of the event.</p>}

      {event.waitlist.length > 0 && (
        <>
          <h3 className="sub-head">Waitlist <span className="count">first come, first served</span></h3>
          <ol className="waitlist">
            {event.waitlist.map((a) => (
              <li key={a.id}>
                <span><strong>{a.name}</strong> <span className="muted">· joined {timeAgo(a.registeredAt)}</span></span>
                <button type="button" className="icon-btn" onClick={() => remove(a)} aria-label={`Remove ${a.name} from waitlist`} title="Remove">×</button>
              </li>
            ))}
          </ol>
          <p className="hint">If someone cancels or you increase capacity, the next person here gets their seat automatically.</p>
        </>
      )}
    </section>
  );
}

function AttendeePanel({ event, today, status, me, setMe, onReplace, log, notify }: DetailProps) {
  const [form, setForm] = useState({ name: me.name, email: me.email, organisation: me.organisation, dietary: me.dietary, note: '' });
  const [regError, setRegError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const myEmail = me.email.toLowerCase();
  const mine = myEmail ? event.attendees.find((a) => a.email.toLowerCase() === myEmail) : undefined;
  const waitIndex = myEmail ? event.waitlist.findIndex((a) => a.email.toLowerCase() === myEmail) : -1;
  const full = event.attendees.length >= event.capacity;

  function submit() {
    const email = form.email.trim();
    if (form.name.trim().length < 2) return setRegError('Please tell us your full name.');
    if (!isValidEmail(email)) return setRegError('That email doesn’t look right. Try something like name@company.com.');
    const taken = [...event.attendees, ...event.waitlist].some((a) => a.email.toLowerCase() === email.toLowerCase());
    if (taken) return setRegError('That email is already registered for this event.');
    setRegError(null);
    const person: Attendee = {
      id: uid(), name: form.name.trim(), email, organisation: form.organisation.trim(), dietary: form.dietary,
      note: form.note.trim(), checkedIn: false, registeredAt: new Date().toISOString(),
    };
    const { event: next, outcome } = registerAttendee(event, person);
    setMe({ name: person.name, email, organisation: person.organisation, dietary: person.dietary });
    onReplace(next);
    log(outcome === 'registered' ? 'registered' : 'waitlisted', next, person.name);
    notify(outcome === 'registered' ? `You’re in, ${firstName(person.name)}!` : `You’re on the waitlist, ${firstName(person.name)}.`);
  }

  function cancel(id: string, wasWaitlisted: boolean) {
    const name = me.name;
    const { event: next, promoted } = cancelAttendee(event, id);
    onReplace(next);
    log('cancelled', next, name);
    if (promoted) log('promoted', next, promoted.name);
    notify(wasWaitlisted ? 'You’ve left the waitlist' : 'Your spot has been cancelled. Thanks for letting us know.');
  }

  if (status === 'past') {
    return <section className="block"><p className="muted">This one’s finished. Keep an eye out for the next one.</p></section>;
  }

  if (mine) {
    const days = relativeDay(event.date, today).toLowerCase();
    return (
      <section className="block confirmed">
        <p className="big-line">You’re going, {firstName(mine.name)}!</p>
        <p>We’ll see you {days === 'today' ? 'today' : days === 'tomorrow' ? 'tomorrow' : `on ${formatDate(event.date).split(',')[0]}`} at {formatTime(event.startTime)}. {event.whatToBring.length ? 'Don’t forget to check what to bring.' : ''}</p>
        <button type="button" className="btn" onClick={() => cancel(mine.id, false)}>I can’t make it anymore</button>
      </section>
    );
  }

  if (waitIndex >= 0) {
    return (
      <section className="block confirmed">
        <p className="big-line">You’re #{waitIndex + 1} on the waitlist</p>
        <p>If a seat opens up, you’ll be moved in automatically. Fingers crossed.</p>
        <button type="button" className="btn" onClick={() => cancel(event.waitlist[waitIndex].id, true)}>Leave the waitlist</button>
      </section>
    );
  }

  return (
    <section className="block">
      <form className="register" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        <h3>{full ? 'Join the waitlist' : 'Save your spot'}</h3>
        <p className="muted">{full ? `It’s fully booked, but ${event.waitlist.length ? `${event.waitlist.length} ${event.waitlist.length === 1 ? 'person is' : 'people are'} waiting and ` : ''}spots often open up closer to the day.` : 'Takes about 30 seconds. We’ll only use your details for this event.'}</p>
        <div className="form-row">
          <label className="field grow" htmlFor="reg-name"><span>Full name</span>
            <input id="reg-name" value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" /></label>
          <label className="field grow" htmlFor="reg-email"><span>Email</span>
            <input id="reg-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" /></label>
        </div>
        <div className="form-row">
          <label className="field grow" htmlFor="reg-org"><span>Organisation <small>(optional)</small></span>
            <input id="reg-org" value={form.organisation} onChange={(e) => set('organisation', e.target.value)} autoComplete="organization" /></label>
          <label className="field grow" htmlFor="reg-diet"><span>Dietary requirements</span>
            <select id="reg-diet" value={form.dietary} onChange={(e) => set('dietary', e.target.value as Dietary)}>
              {DIETARY.map((d) => <option key={d} value={d}>{d}</option>)}
            </select></label>
        </div>
        <label className="field" htmlFor="reg-note"><span>Anything the host should know? <small>(optional)</small></span>
          <textarea id="reg-note" rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="Access needs, arriving late, questions…" /></label>
        {regError && <p className="error" role="alert">{regError}</p>}
        <button type="submit" className="btn primary">{full ? 'Join the waitlist' : 'Register'}</button>
      </form>
    </section>
  );
}

interface FormProps { draft: EventDraft; isNew: boolean; errors: FieldErrors; onChange: (d: EventDraft) => void; onCancel: () => void; onSave: () => void }

function EventForm({ draft, isNew, errors, onChange, onCancel, onSave }: FormProps) {
  const set = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => onChange({ ...draft, [k]: v });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const err = (k: keyof EventDraft) => errors[k] && <span className="error">{errors[k]}</span>;
  const errorCount = Object.keys(errors).length;

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <form className="sheet" onSubmit={(e) => { e.preventDefault(); onSave(); }} noValidate aria-labelledby="form-title">
        <h2 id="form-title">{isNew ? 'Plan a new event' : 'Edit event'}</h2>
        {errorCount > 0 && <p className="error" role="alert">Almost there. {errorCount === 1 ? 'One field needs' : `${errorCount} fields need`} a quick fix.</p>}

        <fieldset>
          <legend>The basics</legend>
          <label className="field" htmlFor="f-title"><span>Event name</span>
            <input id="f-title" value={draft.title} onChange={(e) => set('title', e.target.value)} aria-invalid={!!errors.title} autoFocus placeholder="e.g. Site Safety Refresher" />{err('title')}</label>
          <div className="form-row">
            <label className="field grow" htmlFor="f-category"><span>Category</span>
              <select id="f-category" value={draft.category} onChange={(e) => set('category', e.target.value as Category)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select></label>
            <label className="field grow" htmlFor="f-capacity"><span>Seats available</span>
              <input id="f-capacity" inputMode="numeric" value={draft.capacity} onChange={(e) => set('capacity', e.target.value)} aria-invalid={!!errors.capacity} />{err('capacity')}</label>
          </div>
          <label className="field" htmlFor="f-desc"><span>Description <small>({draft.description.length}/600)</small></span>
            <textarea id="f-desc" rows={3} value={draft.description} onChange={(e) => set('description', e.target.value)} aria-invalid={!!errors.description} placeholder="What will people get out of it?" />{err('description')}</label>
        </fieldset>

        <fieldset>
          <legend>When and where</legend>
          <div className="form-row">
            <label className="field grow" htmlFor="f-date"><span>Date</span>
              <input id="f-date" type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} aria-invalid={!!errors.date} />{err('date')}</label>
            <label className="field" htmlFor="f-start"><span>Starts</span>
              <input id="f-start" type="time" value={draft.startTime} onChange={(e) => set('startTime', e.target.value)} aria-invalid={!!errors.startTime} />{err('startTime')}</label>
            <label className="field" htmlFor="f-end"><span>Finishes</span>
              <input id="f-end" type="time" value={draft.endTime} onChange={(e) => set('endTime', e.target.value)} aria-invalid={!!errors.endTime} />{err('endTime')}</label>
          </div>
          <div className="form-row">
            <label className="field grow" htmlFor="f-venue"><span>Venue</span>
              <input id="f-venue" value={draft.venue} onChange={(e) => set('venue', e.target.value)} aria-invalid={!!errors.venue} />{err('venue')}</label>
            <label className="field grow" htmlFor="f-address"><span>Address <small>(optional)</small></span>
              <input id="f-address" value={draft.address} onChange={(e) => set('address', e.target.value)} /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Details for guests</legend>
          <div className="form-row">
            <label className="field grow" htmlFor="f-host"><span>Host or contact</span>
              <input id="f-host" value={draft.hostName} onChange={(e) => set('hostName', e.target.value)} aria-invalid={!!errors.hostName} />{err('hostName')}</label>
            <label className="field grow" htmlFor="f-host-role"><span>Their role <small>(optional)</small></span>
              <input id="f-host-role" value={draft.hostRole} onChange={(e) => set('hostRole', e.target.value)} /></label>
          </div>
          <label className="field" htmlFor="f-agenda"><span>Agenda <small>(one item per line, starting with a time)</small></span>
            <textarea id="f-agenda" rows={4} value={draft.agenda} onChange={(e) => set('agenda', e.target.value)} aria-invalid={!!errors.agenda} placeholder={'09:00 Welcome and coffee\n09:30 First session'} />{err('agenda')}</label>
          <label className="field" htmlFor="f-bring"><span>What to bring <small>(one per line, optional)</small></span>
            <textarea id="f-bring" rows={2} value={draft.whatToBring} onChange={(e) => set('whatToBring', e.target.value)} placeholder={'Laptop\nPhoto ID'} /></label>
          <label className="field" htmlFor="f-access"><span>Accessibility <small>(optional)</small></span>
            <input id="f-access" value={draft.accessibility} onChange={(e) => set('accessibility', e.target.value)} placeholder="e.g. Step-free entry, hearing loop available" /></label>
        </fieldset>

        <div className="actions end">
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn primary">{isNew ? 'Create event' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
}
