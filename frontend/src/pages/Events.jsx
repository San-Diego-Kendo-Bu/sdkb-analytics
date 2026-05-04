import { useState, useEffect } from 'react';
import styles from '../../css/events.module.css';
import { userManager } from '../js/cognitoManager';

const EVENTS_API = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com/events';
const CONFIGURE_API = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com/events/configure';

const STATUS_COLORS = {
  Past: '#6c757d',
  Ongoing: '#28a745',
  Upcoming: '#0d6efd',
};

const EMPTY_FORM = { title: '', description: '', start_datetime: '', end_datetime: '', location: '', type: '' };
const EMPTY_CONFIG = { shinpan_needed: false, event_deadline: '', divisions: '', teams_included: false, shinsa_levels: '', seminar_guests: '', bring_your_lunch: false };

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
      <label className={styles.label}>Event Date</label>
      <input className={styles.input} type="datetime-local" value={form.start_datetime}
        onChange={e => setForm(f => ({ ...f, start_datetime: e.target.value }))} />
      <label className={styles.label}>Sign Up Deadline</label>
      <input className={styles.input} type="datetime-local" value={form.end_datetime}
        onChange={e => setForm(f => ({ ...f, end_datetime: e.target.value }))} />
      <input className={styles.input} placeholder="Location" value={form.location}
        onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
      <select className={styles.input} value={form.type}
        onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
        <option value="">Select type</option>
        <option value="tournament">Tournament</option>
        <option value="shinsa">Shinsa</option>
        <option value="seminar">Seminar</option>
      </select>
      <div className={styles.formActions}>
        <button className={styles.saveBtn} onClick={onSave}>Save</button>
        <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function ConfigureForm({ eventType, form, setForm, onSave, onCancel }) {
  return (
    <div className={styles.formBox}>
      <p className={styles.formTitle}>Configure {eventType}</p>

      {eventType === 'tournament' && (
        <>
          <label className={styles.label}>Divisions (comma-separated)</label>
          <input className={styles.input} placeholder="e.g. kyu, yudansha" value={form.divisions}
            onChange={e => setForm(f => ({ ...f, divisions: e.target.value }))} />
          <label className={styles.label}>Sign Up Deadline</label>
          <input className={styles.input} type="datetime-local" value={form.event_deadline}
            onChange={e => setForm(f => ({ ...f, event_deadline: e.target.value }))} />
          <label className={styles.label}><input type="checkbox" checked={form.shinpan_needed}
            onChange={e => setForm(f => ({ ...f, shinpan_needed: e.target.checked }))} /> Shinpan needed</label>
          <label className={styles.label}><input type="checkbox" checked={form.teams_included}
            onChange={e => setForm(f => ({ ...f, teams_included: e.target.checked }))} /> Teams included</label>
        </>
      )}

      {eventType === 'shinsa' && (
        <>
          <label className={styles.label}>Shinsa Levels (comma-separated)</label>
          <input className={styles.input} placeholder="e.g. 1dan, 2dan" value={form.shinsa_levels}
            onChange={e => setForm(f => ({ ...f, shinsa_levels: e.target.value }))} />
          <label className={styles.label}><input type="checkbox" checked={form.shinpan_needed}
            onChange={e => setForm(f => ({ ...f, shinpan_needed: e.target.checked }))} /> Shinpan needed</label>
        </>
      )}

      {eventType === 'seminar' && (
        <>
          <label className={styles.label}>Seminar Guests (comma-separated)</label>
          <input className={styles.input} placeholder="e.g. ariga, kunimoto" value={form.seminar_guests}
            onChange={e => setForm(f => ({ ...f, seminar_guests: e.target.value }))} />
          <label className={styles.label}><input type="checkbox" checked={form.bring_your_lunch}
            onChange={e => setForm(f => ({ ...f, bring_your_lunch: e.target.checked }))} /> Bring your lunch</label>
        </>
      )}

      <div className={styles.formActions}>
        <button className={styles.saveBtn} onClick={onSave}>Save</button>
        <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function Events() {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [configuringId, setConfiguringId] = useState(null);
  const [configForm, setConfigForm] = useState(EMPTY_CONFIG);
  const [configs, setConfigs] = useState({});

  useEffect(() => {
    fetch(EVENTS_API)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => {
        const evs = data.body.map(e => ({
          event_id: e.event_id,
          title: e.event_name,
          description: '',
          start_datetime: e.event_date,
          end_datetime: e.event_deadline,
          location: e.event_location,
          type: e.event_type,
        }));
        setEvents(evs);
        return evs;
      })
      .then(evs =>
        Promise.all(
          evs.map(ev =>
            fetch(`${CONFIGURE_API}?event_id=${ev.event_id}`)
              .then(r => r.json())
              .then(r => ({ id: ev.event_id, data: r.data ?? null }))
              .catch(() => ({ id: ev.event_id, data: null }))
          )
        ).then(results => {
          const map = {};
          results.forEach(r => { map[r.id] = r.data; });
          setConfigs(map);
        })
      )
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = events.filter(ev => {
    const status = getStatus(ev.start_datetime, ev.end_datetime);
    const matchFilter = filter === 'All' || status === filter;
    const matchSearch =
      ev.title.toLowerCase().includes(search.toLowerCase()) ||
      ev.description.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  function handleCreate() {
    const payload = {
      event_name: newForm.title,
      event_type: newForm.type,
      event_date: toIso(newForm.start_datetime),
      event_location: newForm.location,
      event_deadline: toIso(newForm.end_datetime),
      created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    };
    userManager.getUser().then(user => fetch(EVENTS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id_token}` },
      body: JSON.stringify(payload),
    }))
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(() => fetch(EVENTS_API))
      .then(res => res.json())
      .then(data => setEvents(data.body.map(e => ({
        event_id: e.event_id,
        title: e.event_name,
        description: '',
        start_datetime: e.event_date,
        end_datetime: e.event_deadline,
        location: e.event_location,
        type: e.event_type,
      }))))
      .catch(err => setError(err.message));
    setShowNew(false);
    setNewForm(EMPTY_FORM);
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
    const payload = {
      event_id: editingId,
      event_name: editForm.title,
      event_type: editForm.type,
      event_date: toIso(editForm.start_datetime),
      event_deadline: toIso(editForm.end_datetime),
      event_location: editForm.location,
    };
    console.log('PATCH payload:', payload);
    setEditingId(null);
    userManager.getUser()
      .then(user => fetch(EVENTS_API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id_token}` },
        body: JSON.stringify(payload),
      }))
      .then(res => { if (!res.ok) return res.json().then(b => { throw new Error(b.message || b.error || `HTTP ${res.status}`); }); return fetch(EVENTS_API); })
      .then(res => res.json())
      .then(data => setEvents(data.body.map(e => ({
        event_id: e.event_id,
        title: e.event_name,
        description: '',
        start_datetime: e.event_date,
        end_datetime: e.event_deadline,
        location: e.event_location,
        type: e.event_type,
      }))))
      .catch(err => setError(err.message));
  }

  function handleConfigureOpen(ev) {
    setConfiguringId(ev.event_id);
    const existing = configs[ev.event_id];
    if (existing && ev.type === 'tournament') {
      setConfigForm({ ...EMPTY_CONFIG, shinpan_needed: existing.shinpan_needed ?? false, divisions: existing.divisions?.join(', ') ?? '', teams_included: existing.teams_included ?? false, event_deadline: toInputValue(ev.end_datetime) });
    } else if (existing && ev.type === 'shinsa') {
      setConfigForm({ ...EMPTY_CONFIG, shinpan_needed: existing.shinpan_needed ?? false, shinsa_levels: existing.shinsa_levels?.join(', ') ?? '' });
    } else if (existing && ev.type === 'seminar') {
      setConfigForm({ ...EMPTY_CONFIG, seminar_guests: existing.seminar_guests?.join(', ') ?? '', bring_your_lunch: existing.bring_your_lunch ?? false });
    } else {
      setConfigForm({ ...EMPTY_CONFIG, event_deadline: toInputValue(ev.end_datetime) });
    }
  }

  function handleConfigureSave(ev) {
    let payload = { event_id: parseInt(ev.event_id, 10) };
    if (ev.type === 'tournament') {
      payload = { ...payload, shinpan_needed: configForm.shinpan_needed, event_deadline: toIso(configForm.event_deadline), divisions: configForm.divisions.split(',').map(s => s.trim()).filter(Boolean), teams_included: configForm.teams_included };
    } else if (ev.type === 'shinsa') {
      payload = { ...payload, shinpan_needed: configForm.shinpan_needed, shinsa_levels: configForm.shinsa_levels.split(',').map(s => s.trim()).filter(Boolean) };
    } else if (ev.type === 'seminar') {
      payload = { ...payload, seminar_guests: configForm.seminar_guests.split(',').map(s => s.trim()).filter(Boolean), bring_your_lunch: configForm.bring_your_lunch };
    }
    setConfiguringId(null);
    userManager.getUser()
      .then(user => fetch(CONFIGURE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id_token}` },
        body: JSON.stringify(payload),
      }))
      .then(res => { if (!res.ok) return res.json().then(b => { throw new Error(b.message || b.error || `HTTP ${res.status}`); }); })
      .then(() => fetch(`${CONFIGURE_API}?event_id=${ev.event_id}`))
      .then(r => r.json())
      .then(r => setConfigs(prev => ({ ...prev, [ev.event_id]: r.data ?? null })))
      .catch(err => setError(err.message));
  }

  function handleDelete(id) {
    userManager.getUser().then(user =>
      fetch(EVENTS_API, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id_token}` },
        body: JSON.stringify({ event_id: id }),
      })
    )
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); })
      .then(() => setEvents(prev => prev.filter(e => e.event_id !== id)))
      .catch(err => setError(err.message));
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
        {loading && <p className={styles.empty}>Loading events...</p>}
        {error && <p className={styles.empty}>Error: {error}</p>}
        {!loading && !error && filtered.length === 0 && <p className={styles.empty}>No events found.</p>}
        {filtered.map(ev => {
          const status = getStatus(ev.start_datetime, ev.end_datetime);
          const { day, month } = formatDateBadge(ev.start_datetime);
          const dateRange = formatDateRange(ev.start_datetime, ev.end_datetime, ev.location);
          const isEditing = editingId === ev.event_id;
          const isConfiguring = configuringId === ev.event_id;

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
                ) : isConfiguring ? (
                  <ConfigureForm
                    eventType={ev.type}
                    form={configForm}
                    setForm={setConfigForm}
                    onSave={() => handleConfigureSave(ev)}
                    onCancel={() => setConfiguringId(null)}
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
                    {configs[ev.event_id] && (() => {
                      const cfg = configs[ev.event_id];
                      return (
                        <div className={styles.configSection}>
                          {ev.type === 'tournament' && (<>
                            {cfg.divisions?.length > 0 && (
                              <div className={styles.configRow}>
                                <span className={styles.configLabel}>Divisions</span>
                                <div className={styles.configTags}>{cfg.divisions.map(d => <span key={d} className={styles.configTag}>{d}</span>)}</div>
                              </div>
                            )}
                            {cfg.teams_included != null && (
                              <div className={styles.configRow}>
                                <span className={styles.configLabel}>Teams</span>
                                <span className={cfg.teams_included ? styles.configBoolTrue : styles.configBoolFalse}>{cfg.teams_included ? 'Yes' : 'No'}</span>
                              </div>
                            )}
                            {cfg.shinpan_needed != null && (
                              <div className={styles.configRow}>
                                <span className={styles.configLabel}>Shinpan</span>
                                <span className={cfg.shinpan_needed ? styles.configBoolTrue : styles.configBoolFalse}>{cfg.shinpan_needed ? 'Yes' : 'No'}</span>
                              </div>
                            )}
                          </>)}
                          {ev.type === 'shinsa' && (<>
                            {cfg.shinsa_levels?.length > 0 && (
                              <div className={styles.configRow}>
                                <span className={styles.configLabel}>Levels</span>
                                <div className={styles.configTags}>{cfg.shinsa_levels.map(l => <span key={l} className={styles.configTag}>{l}</span>)}</div>
                              </div>
                            )}
                            {cfg.shinpan_needed != null && (
                              <div className={styles.configRow}>
                                <span className={styles.configLabel}>Shinpan</span>
                                <span className={cfg.shinpan_needed ? styles.configBoolTrue : styles.configBoolFalse}>{cfg.shinpan_needed ? 'Yes' : 'No'}</span>
                              </div>
                            )}
                          </>)}
                          {ev.type === 'seminar' && (<>
                            {cfg.seminar_guests?.length > 0 && (
                              <div className={styles.configRow}>
                                <span className={styles.configLabel}>Guests</span>
                                <div className={styles.configTags}>{cfg.seminar_guests.map(g => <span key={g} className={styles.configTag}>{g}</span>)}</div>
                              </div>
                            )}
                            {cfg.bring_your_lunch != null && (
                              <div className={styles.configRow}>
                                <span className={styles.configLabel}>Bring lunch</span>
                                <span className={cfg.bring_your_lunch ? styles.configBoolTrue : styles.configBoolFalse}>{cfg.bring_your_lunch ? 'Yes' : 'No'}</span>
                              </div>
                            )}
                          </>)}
                        </div>
                      );
                    })()}
                    <div className={styles.cardActions}>
                      <button className={styles.editBtn} onClick={() => { handleEditOpen(ev); setShowNew(false); setConfiguringId(null); }}>
                        Edit
                      </button>
                      <button className={styles.editBtn} onClick={() => { handleConfigureOpen(ev); setShowNew(false); setEditingId(null); }}>
                        Configure
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
