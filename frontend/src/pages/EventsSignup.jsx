import { useState, useEffect, useRef } from 'react';
import styles from '../../css/events.module.css';
import { userManager } from '../js/cognitoManager';
import { isOffHours, OFF_HOURS_MSG } from '../js/offHours';

const BASE_URL = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';
const EVENTS_API = `${BASE_URL}/events`;
const CONFIGURE_API = `${BASE_URL}/events/configure`;
const MEMBERS_API = `${BASE_URL}/members`;
const REGISTER_API = `${BASE_URL}/events/register`;

const STATUS_COLORS = {
  Past: '#6c757d',
  Ongoing: '#28a745',
  Upcoming: '#0d6efd',
};

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

function SignUpForm({ ev, config, onSubmit, onCancel, submitting }) {
  const [division, setDivision] = useState('');
  const [doingTeams, setDoingTeams] = useState(false);
  const [shinpanning, setShinpanning] = useState(false);
  const [testingFor, setTestingFor] = useState('');
  const [divisionError, setDivisionError] = useState(false);

  function handleSubmit() {
    if (ev.type === 'tournament' && config?.divisions?.length > 0 && !division) {
      setDivisionError(true);
      return;
    }
    setDivisionError(false);
    const extra = {};
    if (ev.type === 'tournament') {
      extra.division = division;
      extra.doing_teams = doingTeams;
      extra.shinpanning = shinpanning;
    } else if (ev.type === 'shinsa') {
      extra.testing_for = testingFor;
    }
    onSubmit(extra);
  }

  return (
    <div className={styles.formBox}>
      <p className={styles.formTitle}>Sign Up — {ev.title}</p>

      {ev.type === 'tournament' && (
        <>
          <label className={styles.label}>Division</label>
          {config?.divisions?.length > 0 ? (
            <>
              <select className={styles.input} value={division} onChange={e => { setDivision(e.target.value); setDivisionError(false); }}>
                <option value="">Select division</option>
                {config.divisions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {divisionError && <span className={styles.fieldError}>Please select a division.</span>}
            </>
          ) : (
            <input className={styles.input} placeholder="Division" value={division}
              onChange={e => setDivision(e.target.value)} />
          )}
          <label className={styles.label}>
            <input type="checkbox" checked={doingTeams} onChange={e => setDoingTeams(e.target.checked)} />{' '}
            Doing teams
          </label>
          {config?.shinpan_needed && (
            <label className={styles.label}>
              <input type="checkbox" checked={shinpanning} onChange={e => setShinpanning(e.target.checked)} />{' '}
              Shinpanning
            </label>
          )}
        </>
      )}

      {ev.type === 'shinsa' && (
        <>
          <label className={styles.label}>Testing for</label>
          {config?.shinsa_levels?.length > 0 ? (
            <select className={styles.input} value={testingFor} onChange={e => setTestingFor(e.target.value)}>
              <option value="">Select level</option>
              {config.shinsa_levels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          ) : (
            <input className={styles.input} placeholder="e.g. 1dan" value={testingFor}
              onChange={e => setTestingFor(e.target.value)} />
          )}
        </>
      )}

      {ev.type === 'seminar' && (
        <p className={styles.cardDesc}>Click confirm to register for this seminar.</p>
      )}

      <div className={styles.formActions}>
        <button className={styles.saveBtn} onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Registering...' : 'Confirm'}
        </button>
        <button className={styles.cancelBtn} onClick={onCancel} disabled={submitting}>Cancel</button>
      </div>
    </div>
  );
}

function EventsSignup() {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signingUpId, setSigningUpId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [registeredIds, setRegisteredIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const memberIdRef = useRef(null);

  useEffect(() => {
    async function loadRegistrations() {
      const user = await userManager.getUser();
      console.log('[registrations] user:', user ? 'found' : 'none', 'expired:', user?.expired);
      if (!user || user.expired) return;

      const email = user.profile?.email;
      console.log('[registrations] email:', email);
      if (!email) return;

      try {
        const membersRes = await fetch(`${MEMBERS_API}?email=${encodeURIComponent(email)}`);
        const membersData = await membersRes.json();
        console.log('[registrations] members response:', membersData);
        if (!membersData.items?.length) return;

        const memberId = membersData.items[0].member_id;
        console.log('[registrations] memberId:', memberId, '(type:', typeof memberId, ')');
        memberIdRef.current = memberId;

        const fetchReg = (path) => fetch(`${BASE_URL}${path}`)
          .then(r => r.json())
          .catch(() => ({ body: [] }));

        const [tourn, shinsa, seminar] = await Promise.all([
          fetchReg('/events/tournamentRegistrations'),
          fetchReg('/events/shinsaRegistrations'),
          fetchReg('/events/seminarRegistrations'),
        ]);

        console.log('[registrations] tourn rows:', tourn.body);
        console.log('[registrations] shinsa rows:', shinsa.body);
        console.log('[registrations] seminar rows:', seminar.body);

        const match = (r) => Number(r.member_id) === Number(memberId);
        const ids = new Set([
          ...(tourn.body || []).filter(match).map(r => r.event_id),
          ...(shinsa.body || []).filter(match).map(r => r.event_id),
          ...(seminar.body || []).filter(match).map(r => r.event_id),
        ]);
        console.log('[registrations] matched event ids:', [...ids]);
        setRegisteredIds(ids);
      } catch (err) {
        console.error('[registrations] failed:', err);
      }
    }
    loadRegistrations();
  }, []);

  useEffect(() => {
    fetch(EVENTS_API)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => {
        const evs = data.body.map(e => ({
          event_id: e.event_id,
          title: e.event_name,
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
    const matchSearch = ev.title.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSignUpClick(ev) {
    const user = await userManager.getUser();
    if (!user || user.expired) {
      alert('Please sign in to register for events.');
      return;
    }
    setSigningUpId(ev.event_id);
  }

  async function resolveMemberId() {
    if (memberIdRef.current != null) return memberIdRef.current;
    const user = await userManager.getUser();
    if (!user || user.expired) {
      alert('Please sign in to register for events.');
      return null;
    }
    const email = user.profile?.email;
    if (!email) {
      alert('Could not determine your email. Please sign in again.');
      return null;
    }
    const membersRes = await fetch(`${MEMBERS_API}?email=${encodeURIComponent(email)}`);
    if (!membersRes.ok) throw new Error(`Could not fetch member info (HTTP ${membersRes.status})`);
    const membersData = await membersRes.json();
    if (!membersData.items?.length) {
      alert('No member account found for your email. Please contact an admin.');
      return null;
    }
    memberIdRef.current = membersData.items[0].member_id;
    return memberIdRef.current;
  }

  async function handleSignUpSubmit(ev, extra) {
    if (isOffHours()) { showToast(OFF_HOURS_MSG); return; }
    setSubmitting(true);
    try {
      const memberId = await resolveMemberId();
      if (memberId == null) return;

      const payload = {
        config_type: ev.type,
        event_id: ev.event_id,
        member_id: memberId,
        registration_date: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        ...extra,
      };

      const res = await fetch(REGISTER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      setRegisteredIds(prev => new Set([...prev, ev.event_id]));
      setSigningUpId(null);
      showToast(`Successfully registered for ${ev.title}.`);
    } catch (err) {
      alert(`Registration failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnregister(ev) {
    if (isOffHours()) { showToast(OFF_HOURS_MSG); return; }
    setSubmitting(true);
    try {
      const memberId = await resolveMemberId();
      if (memberId == null) return;

      const res = await fetch(REGISTER_API, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config_type: ev.type, event_id: ev.event_id, member_id: memberId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      setRegisteredIds(prev => { const next = new Set(prev); next.delete(ev.event_id); return next; });
      showToast(`Successfully unregistered from ${ev.title}.`);
    } catch (err) {
      alert(`Unregister failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Events</h2>
          <span className={styles.count}>{events.length} events</span>
        </div>
        <input
          className={styles.search}
          placeholder="Search events..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.filters}>
        <span className={styles.filtersLabel}>Filter:</span>
        {['All', 'Upcoming', 'Ongoing', 'Past'].map(f => (
          <button
            key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
            onClick={() => setFilter(f)}
          >{f}</button>
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
          const isSigningUp = signingUpId === ev.event_id;
          const isRegistered = registeredIds.has(ev.event_id);
          const cfg = configs[ev.event_id];

          return (
            <div key={ev.event_id} className={styles.card}>
              <div className={styles.dateBadge}>
                <span className={styles.dateDay}>{day}</span>
                <span className={styles.dateMonth}>{month}</span>
              </div>
              <div className={styles.cardBody}>
                {isSigningUp ? (
                  <SignUpForm
                    ev={ev}
                    config={cfg}
                    onSubmit={extra => handleSignUpSubmit(ev, extra)}
                    onCancel={() => setSigningUpId(null)}
                    submitting={submitting}
                  />
                ) : (
                  <>
                    <div className={styles.cardTop}>
                      <span className={styles.cardTitle}>{ev.title}</span>
                      <span className={styles.badge} style={{ backgroundColor: STATUS_COLORS[status] }}>{status}</span>
                      <span className={styles.typeBadge}>{ev.type}</span>
                      {isRegistered && (
                        <span className={styles.badge} style={{ backgroundColor: '#157347' }}>Registered</span>
                      )}
                    </div>
                    <p className={styles.cardMeta}>{dateRange}</p>
                    {cfg && (
                      <div className={styles.configSection}>
                        {ev.type === 'tournament' && (<>
                          {cfg.divisions?.length > 0 && (
                            <div className={styles.configRow}>
                              <span className={styles.configLabel}>Divisions</span>
                              <div className={styles.configTags}>
                                {cfg.divisions.map(d => <span key={d} className={styles.configTag}>{d}</span>)}
                              </div>
                            </div>
                          )}
                          {cfg.teams_included != null && (
                            <div className={styles.configRow}>
                              <span className={styles.configLabel}>Teams</span>
                              <span className={cfg.teams_included ? styles.configBoolTrue : styles.configBoolFalse}>
                                {cfg.teams_included ? 'Yes' : 'No'}
                              </span>
                            </div>
                          )}
                        </>)}
                        {ev.type === 'shinsa' && cfg.shinsa_levels?.length > 0 && (
                          <div className={styles.configRow}>
                            <span className={styles.configLabel}>Levels</span>
                            <div className={styles.configTags}>
                              {cfg.shinsa_levels.map(l => <span key={l} className={styles.configTag}>{l}</span>)}
                            </div>
                          </div>
                        )}
                        {ev.type === 'seminar' && cfg.seminar_guests?.length > 0 && (
                          <div className={styles.configRow}>
                            <span className={styles.configLabel}>Guests</span>
                            <div className={styles.configTags}>
                              {cfg.seminar_guests.map(g => <span key={g} className={styles.configTag}>{g}</span>)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className={styles.cardActions}>
                      {status !== 'Past' && !isRegistered && (
                        <button className={styles.signupBtn} onClick={() => handleSignUpClick(ev)}>
                          Sign Up
                        </button>
                      )}
                      {isRegistered && (
                        <button className={styles.deleteBtn} onClick={() => handleUnregister(ev)} disabled={submitting}>
                          Unregister
                        </button>
                      )}
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

export default EventsSignup;
