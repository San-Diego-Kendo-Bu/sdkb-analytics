import { useState } from 'react';
import styles from '../../css/events.module.css';
// import { rdsRead, rdsWrite } from '../js/shared/rdsTools';

const DUMMY_EVENTS = [
  {
    event_id: 1,
    title: 'Q1 review webinar',
    description: 'Quarterly results and roadmap preview.',
    start_datetime: '2026-03-10T14:00:00Z',
    end_datetime: '2026-03-10T15:00:00Z',
    location: 'Online',
    type: 'Webinar',
  },
  {
    event_id: 2,
    title: 'Dev conference 2026',
    description: 'Three-day developer conference with keynotes.',
    start_datetime: '2026-04-19T08:30:00Z',
    end_datetime: '2026-04-21T17:00:00Z',
    location: 'Convention Center',
    type: 'Conference',
  },
  {
    event_id: 3,
    title: 'Product design workshop',
    description: 'Hands-on session exploring new design methods.',
    start_datetime: '2026-04-22T09:00:00Z',
    end_datetime: '2026-04-23T17:00:00Z',
    location: 'Room 4B',
    type: 'Workshop',
  },
  {
    event_id: 4,
    title: 'Summer kickoff party',
    description: 'Annual summer gathering for all staff.',
    start_datetime: '2026-06-15T18:00:00Z',
    end_datetime: '2026-06-15T22:00:00Z',
    location: 'Rooftop Terrace',
    type: 'Networking',
  },
];

const STATUS_COLORS = {
  Past: '#6c757d',
  Ongoing: '#28a745',
  Upcoming: '#0d6efd',
};

const EMPTY_FORM = { title: '', description: '', start_datetime: '', end_datetime: '', location: '', type: '' };

function getStatus(start, end) {
  const now = new Date();
  const s = new Date(start);
  const e = end ? new Date(end) : s;
  if (now < s) return 'Upcoming';
  if (now > e) return 'Past';
  return 'Ongoing';
}

function formatDateBadge(iso) {
  const d = new Date(iso);
  return {
    day: d.getUTCDate(),
    month: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase(),
  };
}

function formatDateRange(start, end, location) {
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const dateOpts = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };
  const timeOpts = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' };
  const startStr = s.toLocaleDateString('en-GB', dateOpts);
  const timeStr = s.toLocaleTimeString('en-GB', timeOpts);
  if (e && e.toUTCString().slice(0, 16) !== s.toUTCString().slice(0, 16)) {
    const endStr = e.toLocaleDateString('en-GB', dateOpts);
    return `${startStr} – ${endStr} · ${timeStr} · ${location}`;
  }
  return `${startStr} · ${timeStr} · ${location}`;
}

function toInputValue(iso) {
  return iso ? iso.slice(0, 16) : '';
}

function toIso(inputValue) {
  return inputValue ? inputValue + ':00Z' : null;
}

function EventForm({ form, setForm, onSave, onCancel, title }) {
  return (
    <div className={styles.formBox}>
      <p className={styles.formTitle}>{title}</p>
      <input className={styles.input} placeholder="Title" value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
      <input className={styles.input} placeholder="Description" value={form.description}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      <label className={styles.label}>Start</label>
      <input className={styles.input} type="datetime-local" value={form.start_datetime}
        onChange={e => setForm(f => ({ ...f, start_datetime: e.target.value }))} />
      <label className={styles.label}>End (optional)</label>
      <input className={styles.input} type="datetime-local" value={form.end_datetime}
        onChange={e => setForm(f => ({ ...f, end_datetime: e.target.value }))} />
      <input className={styles.input} placeholder="Location" value={form.location}
        onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
      <input className={styles.input} placeholder="Type (e.g. Workshop)" value={form.type}
        onChange={e => setForm(f => ({ ...f, type: e.target.value }))} />
      <div className={styles.formActions}>
        <button className={styles.saveBtn} onClick={onSave}>Save</button>
        <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function Events() {
  const [events, setEvents] = useState(DUMMY_EVENTS);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  // useEffect(() => {
  //   rdsRead('GET', 'events').then(data => { if (data) setEvents(data); });
  // }, []);

  const filtered = events.filter(ev => {
    const status = getStatus(ev.start_datetime, ev.end_datetime);
    const matchFilter = filter === 'All' || status === filter;
    const matchSearch =
      ev.title.toLowerCase().includes(search.toLowerCase()) ||
      ev.description.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  function handleCreate() {
    const created = {
      event_id: Date.now(),
      ...newForm,
      start_datetime: toIso(newForm.start_datetime),
      end_datetime: toIso(newForm.end_datetime),
    };
    setEvents(prev => [...prev, created]);
    setShowNew(false);
    setNewForm(EMPTY_FORM);
    // rdsWrite('POST', 'events', newForm);
  }

  function handleEditOpen(ev) {
    setEditingId(ev.event_id);
    setEditForm({
      title: ev.title,
      description: ev.description,
      start_datetime: toInputValue(ev.start_datetime),
      end_datetime: toInputValue(ev.end_datetime),
      location: ev.location,
      type: ev.type,
    });
  }

  function handleEditSave() {
    setEvents(prev =>
      prev.map(e =>
        e.event_id === editingId
          ? { ...e, ...editForm, start_datetime: toIso(editForm.start_datetime), end_datetime: toIso(editForm.end_datetime) }
          : e
      )
    );
    setEditingId(null);
    // rdsWrite('PATCH', `events/${editingId}`, editForm);
  }

  function handleDelete(id) {
    setEvents(prev => prev.filter(e => e.event_id !== id));
    // rdsWrite('DELETE', `events/${id}`, {});
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Events</h2>
          <span className={styles.count}>{events.length} events</span>
        </div>
        <div className={styles.headerRight}>
          <input
            className={styles.search}
            placeholder="Search events..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className={styles.newBtn} onClick={() => { setShowNew(s => !s); setEditingId(null); }}>
            + New event
          </button>
        </div>
      </div>

      {showNew && (
        <EventForm
          title="New Event"
          form={newForm}
          setForm={setNewForm}
          onSave={handleCreate}
          onCancel={() => setShowNew(false)}
        />
      )}

      <div className={styles.filters}>
        <span className={styles.filtersLabel}>Filter:</span>
        {['All', 'Upcoming', 'Ongoing', 'Past'].map(f => (
          <button
            key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className={styles.list}>
        {filtered.length === 0 && <p className={styles.empty}>No events found.</p>}
        {filtered.map(ev => {
          const status = getStatus(ev.start_datetime, ev.end_datetime);
          const { day, month } = formatDateBadge(ev.start_datetime);
          const dateRange = formatDateRange(ev.start_datetime, ev.end_datetime, ev.location);
          const isEditing = editingId === ev.event_id;

          return (
            <div key={ev.event_id} className={styles.card}>
              <div className={styles.dateBadge}>
                <span className={styles.dateDay}>{day}</span>
                <span className={styles.dateMonth}>{month}</span>
              </div>
              <div className={styles.cardBody}>
                {isEditing ? (
                  <EventForm
                    title="Edit Event"
                    form={editForm}
                    setForm={setEditForm}
                    onSave={handleEditSave}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <div className={styles.cardTop}>
                      <span className={styles.cardTitle}>{ev.title}</span>
                      <span className={styles.badge} style={{ backgroundColor: STATUS_COLORS[status] }}>
                        {status}
                      </span>
                      <span className={styles.typeBadge}>{ev.type}</span>
                    </div>
                    <p className={styles.cardDesc}>{ev.description}</p>
                    <p className={styles.cardMeta}>{dateRange}</p>
                    <div className={styles.cardActions}>
                      <button className={styles.editBtn} onClick={() => { handleEditOpen(ev); setShowNew(false); }}>
                        Edit
                      </button>
                      <button className={styles.deleteBtn} onClick={() => handleDelete(ev.event_id)}>
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Events;
