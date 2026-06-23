import { useState, useEffect } from 'react';
import styles from '../../css/events.module.css';
import { userManager } from '../js/cognitoManager';
import { isOffHours, OFF_HOURS_MSG } from '../js/offHours';
import OffHoursCard from '../react_components/OffHoursCard';

const BASE_URL = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';
const EVENTS_API = `${BASE_URL}/events`;
const CONFIGURE_API = `${BASE_URL}/events/configure`;
const PAYMENTS_API = `${BASE_URL}/payments`;
const SUBMITTED_PAYMENTS_API = `${BASE_URL}/submittedpayments`;

const STATUS_COLORS = {
  Active: '#28a745',
  Past: '#6c757d',
};

const EMPTY_NEW = {
  title: '', description: '', start_datetime: '', end_datetime: '',
  location: '', type: '', payment_id: '',
};

const EMPTY_EDIT = {
  title: '', description: '', start_datetime: '', end_datetime: '',
  location: '', type: '', payment_id: '',
  shinpan_needed: false, event_deadline: '', divisions: '',
  teams_included: false, shinsa_levels: '', seminar_guests: '', bring_your_lunch: false,
};

function getStatus(start, end) {
  const now = new Date();
  const e = end ? new Date(end) : new Date(start);
  return now > e ? 'Past' : 'Active';
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

function NewEventForm({ form, setForm, onSave, onCancel, availablePayments = [] }) {
  return (
    <div className={styles.formBox}>
      <p className={styles.formTitle}>New Event</p>
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
      <label className={styles.label}>Payment</label>
      <select className={styles.input} value={form.payment_id}
        onChange={e => setForm(f => ({ ...f, payment_id: e.target.value }))}>
        <option value="">-- Select --</option>
        <option value="free">No payment required (free event)</option>
        {availablePayments.map(p => (
          <option key={p.payment_id} value={p.payment_id}>
            {p.title} (#{p.payment_id})
          </option>
        ))}
      </select>
      <div className={styles.formActions}>
        <button className={styles.saveBtn} onClick={onSave}>Save</button>
        <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function EditEventForm({ form, setForm, onSave, onCancel, availablePayments = [] }) {
  return (
    <div className={styles.formBox}>
      <p className={styles.formTitle}>Edit Event</p>

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
      <label className={styles.label}>Payment</label>
      <select className={styles.input} value={form.payment_id}
        onChange={e => setForm(f => ({ ...f, payment_id: e.target.value }))}>
        <option value="">-- Select --</option>
        <option value="free">No payment required (free event)</option>
        {availablePayments.map(p => (
          <option key={p.payment_id} value={p.payment_id}>
            {p.title} (#{p.payment_id})
          </option>
        ))}
      </select>

      {form.type === 'tournament' && (
        <>
          <p className={styles.formTitle} style={{ fontSize: '0.85rem', marginTop: '0.75rem', marginBottom: 0 }}>Tournament Config</p>
          <label className={styles.label}>Divisions (comma-separated)</label>
          <input className={styles.input} placeholder="e.g. kyu, yudansha" value={form.divisions}
            onChange={e => setForm(f => ({ ...f, divisions: e.target.value }))} />
          <label className={styles.label}>Sign Up Deadline</label>
          <input className={styles.input} type="datetime-local" value={form.event_deadline}
            onChange={e => setForm(f => ({ ...f, event_deadline: e.target.value }))} />
          <label className={styles.label}>
            <input type="checkbox" checked={form.shinpan_needed}
              onChange={e => setForm(f => ({ ...f, shinpan_needed: e.target.checked }))} />{' '}
            Shinpan needed
          </label>
          <label className={styles.label}>
            <input type="checkbox" checked={form.teams_included}
              onChange={e => setForm(f => ({ ...f, teams_included: e.target.checked }))} />{' '}
            Teams included
          </label>
        </>
      )}

      {form.type === 'shinsa' && (
        <>
          <p className={styles.formTitle} style={{ fontSize: '0.85rem', marginTop: '0.75rem', marginBottom: 0 }}>Shinsa Config</p>
          <label className={styles.label}>Shinsa Levels (comma-separated)</label>
          <input className={styles.input} placeholder="e.g. 1dan, 2dan" value={form.shinsa_levels}
            onChange={e => setForm(f => ({ ...f, shinsa_levels: e.target.value }))} />
          <label className={styles.label}>
            <input type="checkbox" checked={form.shinpan_needed}
              onChange={e => setForm(f => ({ ...f, shinpan_needed: e.target.checked }))} />{' '}
            Shinpan needed
          </label>
        </>
      )}

      {form.type === 'seminar' && (
        <>
          <p className={styles.formTitle} style={{ fontSize: '0.85rem', marginTop: '0.75rem', marginBottom: 0 }}>Seminar Config</p>
          <label className={styles.label}>Seminar Guests (comma-separated)</label>
          <input className={styles.input} placeholder="e.g. ariga, kunimoto" value={form.seminar_guests}
            onChange={e => setForm(f => ({ ...f, seminar_guests: e.target.value }))} />
          <label className={styles.label}>
            <input type="checkbox" checked={form.bring_your_lunch}
              onChange={e => setForm(f => ({ ...f, bring_your_lunch: e.target.checked }))} />{' '}
            Bring your lunch
          </label>
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
  const [newForm, setNewForm] = useState(EMPTY_NEW);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [configs, setConfigs] = useState({});
  const [payments, setPayments] = useState([]);
  const [submittedPaymentIds, setSubmittedPaymentIds] = useState(new Set());

  useEffect(() => {
    Promise.all([
      fetch(PAYMENTS_API).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(SUBMITTED_PAYMENTS_API).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([paymentsData, sbmtData]) => {
      setPayments(paymentsData.data || []);
      setSubmittedPaymentIds(new Set((sbmtData.data || []).map(p => p.payment_id)));
    });
  }, []);

  useEffect(() => {
    if (isOffHours()) { setLoading(false); return; }
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
          payment_id: e.payment_id ?? null,
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

  const filtered = events
    .filter(ev => {
      const status = getStatus(ev.start_datetime, ev.end_datetime);
      const matchFilter = filter === 'All' || status === filter;
      const matchSearch =
        ev.title.toLowerCase().includes(search.toLowerCase()) ||
        ev.description.toLowerCase().includes(search.toLowerCase());
      return matchFilter && matchSearch;
    })
    .sort((a, b) => new Date(b.start_datetime) - new Date(a.start_datetime));

  const linkedPaymentIds = new Set(events.map(e => e.payment_id).filter(Boolean));
  const baseAvailablePayments = payments.filter(p =>
    !p.is_dojo_due && !submittedPaymentIds.has(p.payment_id) && !linkedPaymentIds.has(p.payment_id)
  );

  function getPaymentsForEvent(eventId) {
    const ev = events.find(e => e.event_id === eventId);
    const ownPayment = ev?.payment_id ? payments.find(p => p.payment_id === ev.payment_id) : null;
    if (ownPayment && !baseAvailablePayments.some(p => p.payment_id === ownPayment.payment_id)) {
      return [...baseAvailablePayments, ownPayment];
    }
    return baseAvailablePayments;
  }

  function mapEvent(e) {
    return {
      event_id: e.event_id,
      title: e.event_name,
      description: '',
      start_datetime: e.event_date,
      end_datetime: e.event_deadline,
      location: e.event_location,
      type: e.event_type,
      payment_id: e.payment_id ?? null,
    };
  }

  function handleCreate() {
    if (isOffHours()) { setError(OFF_HOURS_MSG); return; }
    if (!newForm.payment_id) {
      setError('Please select a payment or mark as a free event.');
      return;
    }
    const payload = {
      event_name: newForm.title,
      event_type: newForm.type,
      event_date: toIso(newForm.start_datetime),
      event_location: newForm.location,
      event_deadline: toIso(newForm.end_datetime),
      created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      payment_id: newForm.payment_id === 'free' ? null : parseInt(newForm.payment_id, 10),
    };
    userManager.getUser().then(user => fetch(EVENTS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id_token}` },
      body: JSON.stringify(payload),
    }))
      .then(res => { if (!res.ok) return res.json().then(b => { throw new Error(b.error || `HTTP ${res.status}`); }); return res.json(); })
      .then(() => fetch(EVENTS_API))
      .then(res => res.json())
      .then(data => setEvents(data.body.map(mapEvent)))
      .catch(err => setError(err.message));
    setShowNew(false);
    setNewForm(EMPTY_NEW);
  }

  function handleEditOpen(ev) {
    setEditingId(ev.event_id);
    const existing = configs[ev.event_id];
    let configFields = {
      shinpan_needed: false, event_deadline: '',
      divisions: '', teams_included: false,
      shinsa_levels: '', seminar_guests: '', bring_your_lunch: false,
    };
    if (existing) {
      if (ev.type === 'tournament') {
        configFields = {
          ...configFields,
          shinpan_needed: existing.shinpan_needed ?? false,
          divisions: existing.divisions?.join(', ') ?? '',
          teams_included: existing.teams_included ?? false,
          event_deadline: toInputValue(ev.end_datetime),
        };
      } else if (ev.type === 'shinsa') {
        configFields = {
          ...configFields,
          shinpan_needed: existing.shinpan_needed ?? false,
          shinsa_levels: existing.shinsa_levels?.join(', ') ?? '',
        };
      } else if (ev.type === 'seminar') {
        configFields = {
          ...configFields,
          seminar_guests: existing.seminar_guests?.join(', ') ?? '',
          bring_your_lunch: existing.bring_your_lunch ?? false,
        };
      }
    }
    setEditForm({
      title: ev.title,
      description: ev.description,
      start_datetime: toInputValue(ev.start_datetime),
      end_datetime: toInputValue(ev.end_datetime),
      location: ev.location,
      type: ev.type,
      payment_id: ev.payment_id ? String(ev.payment_id) : 'free',
      ...configFields,
    });
  }

  function handleEditSave() {
    if (isOffHours()) { setError(OFF_HOURS_MSG); return; }
    if (!editForm.payment_id) {
      setError('Please select a payment or mark as a free event.');
      return;
    }

    const eventPayload = {
      event_id: editingId,
      event_name: editForm.title,
      event_type: editForm.type,
      event_date: toIso(editForm.start_datetime),
      event_deadline: toIso(editForm.end_datetime),
      event_location: editForm.location,
      payment_id: editForm.payment_id === 'free' ? null : parseInt(editForm.payment_id, 10),
    };

    let configPayload = { event_id: parseInt(editingId, 10) };
    if (editForm.type === 'tournament') {
      configPayload = {
        ...configPayload,
        shinpan_needed: editForm.shinpan_needed,
        event_deadline: toIso(editForm.event_deadline),
        divisions: editForm.divisions.split(',').map(s => s.trim()).filter(Boolean),
        teams_included: editForm.teams_included,
      };
    } else if (editForm.type === 'shinsa') {
      configPayload = {
        ...configPayload,
        shinpan_needed: editForm.shinpan_needed,
        shinsa_levels: editForm.shinsa_levels.split(',').map(s => s.trim()).filter(Boolean),
      };
    } else if (editForm.type === 'seminar') {
      configPayload = {
        ...configPayload,
        seminar_guests: editForm.seminar_guests.split(',').map(s => s.trim()).filter(Boolean),
        bring_your_lunch: editForm.bring_your_lunch,
      };
    }

    const savedId = editingId;
    setEditingId(null);

    userManager.getUser()
      .then(user => {
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id_token}` };
        return Promise.all([
          fetch(EVENTS_API, { method: 'PATCH', headers, body: JSON.stringify(eventPayload) }),
          fetch(CONFIGURE_API, { method: 'POST', headers, body: JSON.stringify(configPayload) }),
        ]);
      })
      .then(([evRes, cfgRes]) => {
        if (!evRes.ok) return evRes.json().then(b => { throw new Error(b.message || b.error || `HTTP ${evRes.status}`); });
        if (!cfgRes.ok) return cfgRes.json().then(b => { throw new Error(b.message || b.error || `HTTP ${cfgRes.status}`); });
        return Promise.all([fetch(EVENTS_API), fetch(`${CONFIGURE_API}?event_id=${savedId}`)]);
      })
      .then(([evRes, cfgRes]) => Promise.all([evRes.json(), cfgRes.json()]))
      .then(([evData, cfgData]) => {
        setEvents(evData.body.map(mapEvent));
        setConfigs(prev => ({ ...prev, [savedId]: cfgData.data ?? null }));
      })
      .catch(err => setError(err.message));
  }

  function handleDelete(id) {
    if (isOffHours()) { setError(OFF_HOURS_MSG); return; }
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
        <NewEventForm
          form={newForm}
          setForm={setNewForm}
          onSave={handleCreate}
          onCancel={() => setShowNew(false)}
          availablePayments={baseAvailablePayments}
        />
      )}

      <div className={styles.filters}>
        <span className={styles.filtersLabel}>Filter:</span>
        {['All', 'Active', 'Past'].map(f => (
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
        {!loading && isOffHours() && <OffHoursCard />}
        {!isOffHours() && error && <p className={styles.empty}>Error: {error}</p>}
        {!loading && !error && filtered.length === 0 && <p className={styles.empty}>No events found.</p>}
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
                  <EditEventForm
                    form={editForm}
                    setForm={setEditForm}
                    onSave={handleEditSave}
                    onCancel={() => setEditingId(null)}
                    availablePayments={getPaymentsForEvent(editingId)}
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
                          <div className={styles.configRow}>
                            <span className={styles.configLabel}>Payment</span>
                            {ev.payment_id ? (
                              <span className={styles.configTag}>
                                {payments.find(p => p.payment_id === ev.payment_id)?.title ?? `#${ev.payment_id}`}
                                {' '}(#{ev.payment_id})
                              </span>
                            ) : (
                              <span className={styles.configBoolFalse}>None</span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
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
