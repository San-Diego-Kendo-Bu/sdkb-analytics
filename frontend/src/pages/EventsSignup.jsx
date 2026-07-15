import { useState, useEffect, useRef } from 'react';
import styles from '../../css/events.module.css';
import { userManager } from '../js/cognitoManager';
import { isOffHours, OFF_HOURS_MSG } from '../js/offHours';
import OffHoursCard from '../react_components/OffHoursCard';

const BASE_URL = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';
const EVENTS_API            = `${BASE_URL}/events`;
const CONFIGURE_API         = `${BASE_URL}/events/configure`;
const MEMBERS_API           = `${BASE_URL}/members`;
const REGISTER_API          = `${BASE_URL}/events/register`;
const PAYMENTS_API          = `${BASE_URL}/payments`;
const ASSIGNED_PAYMENTS_API = `${BASE_URL}/assignedpayments`;
const SUBMITTED_PAYMENTS_API = `${BASE_URL}/submittedpayments`;
const SPECIAL_EVENT_API      = `${BASE_URL}/events/specialEventRegistrations`;

const STATUS_COLORS = {
  Active: '#28a745',
  Past: '#6c757d',
};

function fmtType(type) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

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

function calcAge(birthday) {
  if (!birthday) return null;
  const dob = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function SignUpForm({ ev, config, member, onSubmit, onCancel, submitting }) {
  const [division, setDivision] = useState('');
  const [doingTeams, setDoingTeams] = useState(false);
  const [shinpanning, setShinpanning] = useState(false);
  const [testingFor, setTestingFor] = useState('');
  const [divisionError, setDivisionError] = useState(false);
  const [weightLbs, setWeightLbs] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');

  const age = calcAge(member?.birthday);

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
      extra.weight = weightLbs ? parseFloat(weightLbs) : null;
      extra.height = (heightFt || heightIn)
        ? parseInt(heightFt || 0) * 12 + parseInt(heightIn || 0)
        : null;
      extra.age = age;
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
          <label className={styles.label}>Weight (lbs)</label>
          <input className={styles.input} type="number" min="0" placeholder="e.g. 150"
            value={weightLbs} onChange={e => setWeightLbs(e.target.value)} />
          <label className={styles.label}>Height</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input className={styles.input} type="number" min="0" max="8" placeholder="ft"
              value={heightFt} onChange={e => setHeightFt(e.target.value)} style={{ flex: 1 }} />
            <input className={styles.input} type="number" min="0" max="11" placeholder="in"
              value={heightIn} onChange={e => setHeightIn(e.target.value)} style={{ flex: 1 }} />
          </div>
          {age !== null && (
            <div className={styles.label} style={{ marginTop: '0.5rem' }}>
              Age: <strong>{age}</strong>
            </div>
          )}
          {config?.teams_included && (
            <label className={styles.label}>
              <input type="checkbox" checked={doingTeams} onChange={e => setDoingTeams(e.target.checked)} />{' '}
              Doing teams
            </label>
          )}
          {config?.shinpan_needed &&
            (member?.rank_type === 'shihan' || (member?.rank_type === 'dan' && Number(member?.rank_number) >= 4)) && (
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

      {ev.type === 'special_event' && (
        <p className={styles.cardDesc}>Click confirm to register for this event.</p>
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

function EventsSignup({ onPayNavigate }) {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signingUpId, setSigningUpId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [externalClickedIds, setExternalClickedIds] = useState(new Set());
  const [externalChecked, setExternalChecked] = useState(new Set());
  const [registeredIds, setRegisteredIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [paymentMap, setPaymentMap] = useState({});
  const [assignedPaymentIds, setAssignedPaymentIds] = useState(new Set());
  const [paidPaymentIds, setPaidPaymentIds] = useState(new Set());
  const memberIdRef = useRef(null);
  const memberRankRef = useRef(null);

  useEffect(() => {
    async function loadRegistrations() {
      const user = await userManager.getUser();
      console.log('[registrations] user:', user ? 'found' : 'none', 'expired:', user?.expired);
      if (!user || user.expired) return;

      const username = user.profile?.preferred_username;
      if (!username) return;

      try {
        const usernameRes = await fetch(`${MEMBERS_API}?username=${encodeURIComponent(username)}`);
        const usernameData = await usernameRes.json();
        if (!usernameData.items?.length) return;

        const memberId = usernameData.items[0].member_id;
        memberIdRef.current = memberId;

        const fullRes = await fetch(`${MEMBERS_API}?member_id=${memberId}`);
        const fullData = await fullRes.json();
        const memberItem = fullData.items?.[0];
        if (memberItem) {
          memberRankRef.current = { rank_type: memberItem.rank_type, rank_number: memberItem.rank_number, birthday: memberItem.birthday ?? null };
        }

        const fetchReg = (path) => fetch(`${BASE_URL}${path}`)
          .then(r => r.json())
          .catch(() => ({ body: [] }));

        const [tourn, shinsa, seminar, special, payData, asgnData, submittedData] = await Promise.all([
          fetchReg('/events/tournamentRegistrations'),
          fetchReg('/events/shinsaRegistrations'),
          fetchReg('/events/seminarRegistrations'),
          fetchReg('/events/specialEventRegistrations'),
          fetch(PAYMENTS_API).then(r => r.json()).catch(() => ({ data: [] })),
          fetch(ASSIGNED_PAYMENTS_API).then(r => r.json()).catch(() => ({ data: [] })),
          fetch(SUBMITTED_PAYMENTS_API).then(r => r.json()).catch(() => ({ data: [] })),
        ]);

        const match = (r) => Number(r.member_id) === Number(memberId);
        const ids = new Set([
          ...(tourn.body || []).filter(match).map(r => r.event_id),
          ...(shinsa.body || []).filter(match).map(r => r.event_id),
          ...(seminar.body || []).filter(match).map(r => r.event_id),
          ...(special.body || []).filter(match).map(r => r.event_id),
        ]);
        setRegisteredIds(ids);

        setPaymentMap(Object.fromEntries((payData.data ?? []).map(p => [String(p.payment_id), p])));
        setAssignedPaymentIds(new Set(
          (asgnData.data ?? []).filter(a => Number(a.member_id) === Number(memberId)).map(a => String(a.payment_id))
        ));
        setPaidPaymentIds(new Set(
          (submittedData.data ?? []).filter(s => Number(s.member_id) === Number(memberId)).map(s => String(s.payment_id))
        ));
      } catch (err) {
        console.error('[registrations] failed:', err);
      }
    }
    loadRegistrations();
  }, []);

  useEffect(() => {
    if (isOffHours()) { setLoading(false); return; }
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
          payment_id: e.payment_id ?? null,
          description: e.description ?? '',
          maps_link: e.maps_link ?? '',
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
      const matchSearch = ev.title.toLowerCase().includes(search.toLowerCase());
      return matchFilter && matchSearch;
    })
    .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));

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
    const cfg = configs[ev.event_id];
    if (cfg?.external_signup_url) {
      window.open(cfg.external_signup_url, '_blank', 'noopener,noreferrer');
      setExternalClickedIds(prev => new Set([...prev, ev.event_id]));
    } else {
      setSigningUpId(ev.event_id);
    }
  }

  async function resolveMemberId() {
    if (memberIdRef.current != null) return memberIdRef.current;
    const user = await userManager.getUser();
    if (!user || user.expired) {
      alert('Please sign in to register for events.');
      return null;
    }
    const username = user.profile?.preferred_username;
    if (!username) {
      alert('Could not determine your account. Please sign in again.');
      return null;
    }
    const usernameRes = await fetch(`${MEMBERS_API}?username=${encodeURIComponent(username)}`);
    if (!usernameRes.ok) throw new Error(`Could not fetch member info (HTTP ${usernameRes.status})`);
    const usernameData = await usernameRes.json();
    if (!usernameData.items?.length) {
      alert('No member account found. Please contact an admin.');
      return null;
    }
    const memberId = usernameData.items[0].member_id;
    memberIdRef.current = memberId;
    const fullRes = await fetch(`${MEMBERS_API}?member_id=${memberId}`);
    const fullData = await fullRes.json();
    const memberItem = fullData.items?.[0];
    if (memberItem) {
      memberRankRef.current = { rank_type: memberItem.rank_type, rank_number: memberItem.rank_number };
    }
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
        {['All', 'Active', 'Past'].map(f => (
          <button
            key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
            onClick={() => setFilter(f)}
          >{f}</button>
        ))}
      </div>

      <div className={styles.list}>
        {loading && <p className={styles.empty}>Loading events...</p>}
        {!loading && isOffHours() && <OffHoursCard />}
        {!isOffHours() && error && <p className={styles.empty}>Error: {error}</p>}
        {!loading && !error && !isOffHours() && filtered.length === 0 && <p className={styles.empty}>No events found.</p>}
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
                    member={memberRankRef.current}
                    onSubmit={extra => handleSignUpSubmit(ev, extra)}
                    onCancel={() => setSigningUpId(null)}
                    submitting={submitting}
                  />
                ) : (
                  <>
                    <div className={styles.cardTop}>
                      <span className={styles.cardTitle}>{ev.title}</span>
                      <span className={styles.badge} style={{ backgroundColor: STATUS_COLORS[status] }}>{status}</span>
                      <span className={styles.typeBadge}>{fmtType(ev.type)}</span>
                      {isRegistered && (
                        <span className={styles.badge} style={{ backgroundColor: '#157347' }}>Registered</span>
                      )}
                    </div>
                    <p className={styles.cardMeta}>{dateRange}</p>
                    {ev.description && <p className={styles.cardDesc}>{ev.description}</p>}
                    {ev.maps_link && (
                      <a href={ev.maps_link} target="_blank" rel="noopener noreferrer" className={styles.mapsLink}>
                        📍 View on Google Maps
                      </a>
                    )}
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
                        {(ev.type === 'seminar' || ev.type === 'special_event') && cfg.bring_your_lunch && (
                          <div className={styles.configRow}>
                            <span className={styles.configLabel}>Bring lunch</span>
                            <span className={styles.configBoolTrue}>Yes</span>
                          </div>
                        )}
                      </div>
                    )}
                    {ev.payment_id && paymentMap[String(ev.payment_id)] && (() => {
                      const pid = String(ev.payment_id);
                      const pay = paymentMap[pid];
                      const isAssigned = assignedPaymentIds.has(pid);
                      const isPaid = paidPaymentIds.has(pid);
                      return (
                        <div className={styles.paymentRow}>
                          <span className={styles.paymentIcon}>💳</span>
                          <span className={styles.paymentTitle}>{pay.title}</span>
                          <span className={styles.paymentAmount}>${Number(pay.payment_value ?? 0).toFixed(2)}</span>
                          {isPaid && <span className={styles.paidBadge}>Paid ✓</span>}
                          {isAssigned && !isPaid && onPayNavigate && (
                            <button className={styles.payNowBtn} onClick={() => onPayNavigate(ev.payment_id)}>
                              Pay Now →
                            </button>
                          )}
                        </div>
                      );
                    })()}
                    <div className={styles.cardActions}>
                      {status !== 'Past' && !isRegistered && !externalClickedIds.has(ev.event_id) && (
                        <button className={styles.signupBtn} onClick={() => handleSignUpClick(ev)}>
                          Sign Up
                        </button>
                      )}
                      {status !== 'Past' && !isRegistered && externalClickedIds.has(ev.event_id) && (
                        <div className={styles.externalConfirm}>
                          <label className={styles.externalCheckLabel}>
                            <input
                              type="checkbox"
                              checked={externalChecked.has(ev.event_id)}
                              onChange={e => setExternalChecked(prev => {
                                const next = new Set(prev);
                                e.target.checked ? next.add(ev.event_id) : next.delete(ev.event_id);
                                return next;
                              })}
                            />
                            {' '}I have completed sign-up on the external site
                          </label>
                          <div className={styles.externalActions}>
                            <button
                              className={styles.signupBtn}
                              disabled={!externalChecked.has(ev.event_id)}
                              onClick={() => setSigningUpId(ev.event_id)}
                            >
                              Register via Portal
                            </button>
                            <button
                              className={styles.cancelBtn}
                              onClick={() => {
                                setExternalClickedIds(prev => { const next = new Set(prev); next.delete(ev.event_id); return next; });
                                setExternalChecked(prev => { const next = new Set(prev); next.delete(ev.event_id); return next; });
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
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
