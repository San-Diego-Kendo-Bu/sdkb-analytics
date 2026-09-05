import { useState, useEffect, useRef } from 'react';
import styles from '../../css/events.module.css';
import { userManager } from '../js/cognitoManager';
import { isOffHours, OFF_HOURS_MSG } from '../js/offHours';
import { mapWithConcurrency } from '../js/shared/concurrency';
import { fetchJsonSafe } from '../js/shared/fetchSafe';
import OffHoursCard from '../react_components/OffHoursCard';

const BASE_URL = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';
const EVENTS_API = `${BASE_URL}/events`;
const CONFIGURE_API = `${BASE_URL}/events/configure`;
const MEMBERS_API = `${BASE_URL}/members`;
const REGISTER_API = `${BASE_URL}/events/register`;
const PAYMENTS_API = `${BASE_URL}/payments`;
const ASSIGNED_PAYMENTS_API = `${BASE_URL}/assignedpayments`;
const SUBMITTED_PAYMENTS_API = `${BASE_URL}/submittedpayments`;
const SPECIAL_EVENT_API = `${BASE_URL}/events/specialEventRegistrations`;
const FAMILIES_MINE_API = `${BASE_URL}/families/mine`;

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

function compareEvents(a, b) {
  const aPast = getStatus(a.start_datetime, a.event_end_datetime) === 'Past';
  const bPast = getStatus(b.start_datetime, b.event_end_datetime) === 'Past';
  if (aPast !== bPast) return aPast ? 1 : -1;
  const diff = new Date(a.start_datetime) - new Date(b.start_datetime);
  return aPast ? -diff : diff;
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
  const startDateStr = s.toLocaleDateString('en-GB', dateOpts);
  const startTimeStr = s.toLocaleTimeString('en-GB', timeOpts);
  if (e && e.toUTCString().slice(0, 16) !== s.toUTCString().slice(0, 16)) {
    const endDateStr = e.toLocaleDateString('en-GB', dateOpts);
    const endTimeStr = e.toLocaleTimeString('en-GB', timeOpts);
    return `${startDateStr} ${startTimeStr} – ${endDateStr} ${endTimeStr} · ${location}`;
  }
  return `${startDateStr} · ${startTimeStr} · ${location}`;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  const dateOpts = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };
  const timeOpts = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' };
  return `${d.toLocaleDateString('en-GB', dateOpts)} · ${d.toLocaleTimeString('en-GB', timeOpts)}`;
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

async function fetchEventConfig(eventId, attempts = 3, delayMs = 500) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${CONFIGURE_API}?event_id=${eventId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const r = await res.json();
      return { data: r.data ?? null, failed: false };
    } catch {
      if (i === attempts - 1) return { data: null, failed: true };
      await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
    }
  }
}

const REGISTRATION_TYPE_ENDPOINTS = [
  { type: 'tournament', path: '/events/tournamentRegistrations' },
  { type: 'shinsa', path: '/events/shinsaRegistrations' },
  { type: 'seminar', path: '/events/seminarRegistrations' },
  { type: 'special_event', path: '/events/specialEventRegistrations' },
];

function SignUpForm({ ev, config, member, selfId, targetOptions, familyMembersInfo, paymentMap, onSubmit, onCancel, submitting }) {
  const [divisions, setDivisions] = useState([]);
  const [doingTeams, setDoingTeams] = useState(false);
  const [shinpanning, setShinpanning] = useState(false);
  const [testingFor, setTestingFor] = useState('');
  const [divisionError, setDivisionError] = useState(false);
  const [paymentError, setPaymentError] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [targetMemberId, setTargetMemberId] = useState(targetOptions?.[0]?.member_id ?? selfId);

  const canDelegate = (targetOptions?.length ?? 0) > 1;
  const isSelf = Number(targetMemberId) === Number(selfId);
  const effectiveMember = isSelf ? member : familyMembersInfo?.[String(targetMemberId)];

  const age = calcAge(effectiveMember?.birthday);

  const eligiblePaymentOptions = (config?.payment_options ?? []).filter(o => {
    if (!o.restriction_type) return true;
    if (age == null) return false;
    if (o.restriction_type === 'at_most') return age <= o.age_limit;
    if (o.restriction_type === 'below') return age < o.age_limit;
    if (o.restriction_type === 'at_least') return age >= o.age_limit;
    return true;
  });

  function toggleDivision(d) {
    setDivisions(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
    setDivisionError(false);
  }

  function selectDivision(d) {
    setDivisions([d]);
    setDivisionError(false);
  }

  function handleSubmit() {
    if (ev.type === 'tournament' && config?.divisions?.length > 0 && divisions.length === 0) {
      setDivisionError(true);
      return;
    }
    if (ev.type === 'tournament' && config?.payment_required && divisions.length !== 1) {
      setDivisionError(true);
      return;
    }
    if (ev.type === 'tournament' && config?.payment_required && !selectedPaymentId) {
      setPaymentError(true);
      return;
    }
    setDivisionError(false);
    setPaymentError(false);
    const extra = {};
    if (ev.type === 'tournament') {
      extra.divisions = divisions;
      extra.doing_teams = doingTeams;
      extra.shinpanning = shinpanning;
      extra.weight = weightLbs ? parseFloat(weightLbs) : null;
      extra.height = (heightFt || heightIn)
        ? parseInt(heightFt || 0) * 12 + parseInt(heightIn || 0)
        : null;
      extra.age = age;
      if (config?.payment_required) extra.payment_id = selectedPaymentId;
    } else if (ev.type === 'shinsa') {
      extra.testing_for = testingFor;
    }
    onSubmit(extra, targetMemberId);
  }

  return (
    <div className={styles.formBox}>
      <p className={styles.formTitle}>Sign Up — {ev.title}</p>

      {canDelegate && (
        <>
          <label className={styles.label}>Who is this for?</label>
          <select
            className={styles.input}
            value={targetMemberId ?? ''}
            onChange={e => setTargetMemberId(Number(e.target.value))}
            style={{ marginBottom: '0.75rem' }}
          >
            {targetOptions.map(o => (
              <option key={o.member_id} value={o.member_id}>{o.label}</option>
            ))}
          </select>
        </>
      )}

      {!canDelegate && targetOptions?.length === 1 && targetOptions[0].member_id !== selfId && (
        <p className={styles.cardDesc} style={{ marginBottom: '0.75rem' }}>
          Signing up: <strong>{targetOptions[0].label}</strong>
        </p>
      )}

      {ev.type === 'tournament' && (
        <>
          <label className={styles.label}>{config?.payment_required ? 'Division (select 1)' : 'Division(s)'}</label>
          {config?.divisions?.length > 0 ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.25rem' }}>
                {config.divisions.map(d => (
                  <label key={d} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    <input
                      type={config.payment_required ? 'radio' : 'checkbox'}
                      name="division"
                      checked={divisions.includes(d)}
                      onChange={() => config.payment_required ? selectDivision(d) : toggleDivision(d)}
                    />
                    {d}
                  </label>
                ))}
              </div>
              {divisionError && (
                <span className={styles.fieldError}>
                  {config.payment_required ? 'Please select exactly one division.' : 'Please select at least one division.'}
                </span>
              )}
            </>
          ) : (
            <input className={styles.input} placeholder="Division" value={divisions[0] ?? ''}
              onChange={e => setDivisions(e.target.value ? [e.target.value] : [])} />
          )}
          {config?.payment_required && (
            <>
              <label className={styles.label}>Payment</label>
              {eligiblePaymentOptions.length > 0 ? (
                <select className={styles.input} value={selectedPaymentId}
                  onChange={e => { setSelectedPaymentId(e.target.value); setPaymentError(false); }}>
                  <option value="">-- Select payment --</option>
                  {eligiblePaymentOptions.map(o => {
                    const pay = paymentMap?.[String(o.payment_id)];
                    const label = pay ? `${pay.title} — $${Number(pay.payment_value ?? 0).toFixed(2)}` : `Payment #${o.payment_id}`;
                    return <option key={o.payment_id} value={o.payment_id}>{label}</option>;
                  })}
                </select>
              ) : (
                <p className={styles.fieldError}>
                  {age == null
                    ? 'No payment option is available: please make sure your birthday is on file, then try again.'
                    : 'No payment option is available for your age. Please contact the organizer.'}
                </p>
              )}
              {paymentError && <span className={styles.fieldError}>Please select a payment option.</span>}
            </>
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
            (effectiveMember?.rank_type === 'shihan' || (effectiveMember?.rank_type === 'dan' && Number(effectiveMember?.rank_number) >= 4)) && (
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
  const [configErrorIds, setConfigErrorIds] = useState(new Set());
  const [retryingConfigIds, setRetryingConfigIds] = useState(new Set());
  const [regCheckFailedTypes, setRegCheckFailedTypes] = useState(new Set());
  const [paymentDataFailed, setPaymentDataFailed] = useState(false);
  const [retryingRegistrations, setRetryingRegistrations] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signingUpId, setSigningUpId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [externalClickedIds, setExternalClickedIds] = useState(new Set());
  const [externalChecked, setExternalChecked] = useState(new Set());
  const [registeredIds, setRegisteredIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [viewMode, setViewMode] = useState('events');
  const [allRegs, setAllRegs] = useState(null);
  const [allMembersMap, setAllMembersMap] = useState({});
  const [signupsLoading, setSignupsLoading] = useState(false);
  const [paymentMap, setPaymentMap] = useState({});
  const [assignedPaymentIds, setAssignedPaymentIds] = useState(new Set());
  const [paidPaymentIds, setPaidPaymentIds] = useState(new Set());
  const [family, setFamily] = useState({ family_id: null, is_parent: false, members: [] });
  const [familyMembersInfo, setFamilyMembersInfo] = useState({});
  const memberIdRef = useRef(null);
  const memberRankRef = useRef(null);

  async function getAuthHeader() {
    const user = await userManager.getUser();
    if (!user || user.expired) return {};
    return { Authorization: `Bearer ${user.id_token}` };
  }

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

      try {
        const authHeader = await getAuthHeader();
        const famRes = await fetch(FAMILIES_MINE_API, { headers: authHeader });
        if (famRes.ok) {
          const famData = await famRes.json();
          setFamily(famData);
          const others = famData.is_parent
            ? (famData.members ?? []).filter(m => Number(m.member_id) !== Number(memberId))
            : [];
          if (others.length > 0) {
            const allMembersRes = await fetch(MEMBERS_API);
            const allMembersData = await allMembersRes.json();
            const infoMap = {};
            for (const m of allMembersData.items ?? []) {
              infoMap[String(m.member_id)] = {
                first_name: m.first_name,
                last_name: m.last_name,
                birthday: m.birthday ?? null,
                rank_type: m.rank_type,
                rank_number: m.rank_number,
              };
            }
            setFamilyMembersInfo(infoMap);
            // Need to know which family members are already registered for which events,
            // so the "Sign Up" action can stay available for un-registered family members
            // even after the parent has registered themselves.
            await loadSignups();
          }
        }
      } catch (famErr) {
        console.error('[registrations] family fetch failed:', famErr);
      }

      const fullRes = await fetch(`${MEMBERS_API}?member_id=${memberId}`);
      const fullData = await fullRes.json();
      const memberItem = fullData.items?.[0];
      if (memberItem) {
        memberRankRef.current = { rank_type: memberItem.rank_type, rank_number: memberItem.rank_number, birthday: memberItem.birthday ?? null };
      }

      const regFetchers = [
        ...REGISTRATION_TYPE_ENDPOINTS.map(e => () => fetchJsonSafe(`${BASE_URL}${e.path}`)),
        () => fetchJsonSafe(PAYMENTS_API),
        () => fetchJsonSafe(ASSIGNED_PAYMENTS_API),
        () => fetchJsonSafe(SUBMITTED_PAYMENTS_API),
      ];

      const results = await mapWithConcurrency(regFetchers, 2, fn => fn());
      const [tournR, shinsaR, seminarR, specialR, payR, asgnR, submittedR] = results;

      const failedTypes = new Set(
        REGISTRATION_TYPE_ENDPOINTS.filter((_, i) => results[i].failed).map(e => e.type)
      );
      setRegCheckFailedTypes(failedTypes);
      setPaymentDataFailed(payR.failed || asgnR.failed || submittedR.failed);

      const tourn = tournR.data ?? { body: [] };
      const shinsa = shinsaR.data ?? { body: [] };
      const seminar = seminarR.data ?? { body: [] };
      const special = specialR.data ?? { body: [] };
      const payData = payR.data ?? { data: [] };
      const asgnData = asgnR.data ?? { data: [] };
      const submittedData = submittedR.data ?? { data: [] };

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

  useEffect(() => {
    loadRegistrations();
  }, []);

  async function retryRegistrationCheck() {
    setRetryingRegistrations(true);
    await loadRegistrations();
    setRetryingRegistrations(false);
  }

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
          event_end_datetime: e.event_end_date ?? null,
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
        mapWithConcurrency(evs, 2, ev => fetchEventConfig(ev.event_id).then(r => ({ id: ev.event_id, ...r }))).then(results => {
          const map = {};
          const errs = new Set();
          results.forEach(r => {
            map[r.id] = r.data;
            if (r.failed) errs.add(r.id);
          });
          setConfigs(map);
          setConfigErrorIds(errs);
        })
      )
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = events
    .filter(ev => {
      const status = getStatus(ev.start_datetime, ev.event_end_datetime);
      const matchFilter = filter === 'All' || status === filter;
      const matchSearch = ev.title.toLowerCase().includes(search.toLowerCase());
      return matchFilter && matchSearch;
    })
    .sort(compareEvents);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function retryEventConfig(ev) {
    setRetryingConfigIds(prev => new Set([...prev, ev.event_id]));
    const r = await fetchEventConfig(ev.event_id);
    setConfigs(prev => ({ ...prev, [ev.event_id]: r.data }));
    setConfigErrorIds(prev => {
      const next = new Set(prev);
      r.failed ? next.add(ev.event_id) : next.delete(ev.event_id);
      return next;
    });
    setRetryingConfigIds(prev => { const next = new Set(prev); next.delete(ev.event_id); return next; });
  }

  async function handleSignUpClick(ev) {
    const user = await userManager.getUser();
    if (!user || user.expired) {
      alert('Please sign in to register for events.');
      return;
    }
    if (configErrorIds.has(ev.event_id)) {
      alert('Event details failed to load. Please retry loading details before signing up.');
      return;
    }
    if (regCheckFailedTypes.has(ev.type)) {
      alert('Could not verify your registration status. Please retry before signing up.');
      return;
    }
    if (ev.end_datetime && new Date() > new Date(ev.end_datetime)) {
      alert('Sign-up for this event has closed.');
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

  async function handleSignUpSubmit(ev, extra, targetMemberId) {
    if (isOffHours()) { showToast(OFF_HOURS_MSG); return; }
    setSubmitting(true);
    try {
      const selfMemberId = await resolveMemberId();
      if (selfMemberId == null) return;
      const memberId = targetMemberId ?? selfMemberId;
      const isSelf = Number(memberId) === Number(selfMemberId);

      const payload = {
        config_type: ev.type,
        event_id: ev.event_id,
        member_id: memberId,
        registration_date: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        ...extra,
      };

      const authHeader = await getAuthHeader();
      const res = await fetch(REGISTER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      if (isSelf) {
        setRegisteredIds(prev => new Set([...prev, ev.event_id]));
      }
      if (family.is_parent) {
        // Refresh cached family registration data so this event's targetOptions
        // no longer offer the member we just registered.
        await loadSignups(true);
      }
      setSigningUpId(null);
      const who = isSelf ? 'you' : (familyMembersInfo[String(memberId)]
        ? `${familyMembersInfo[String(memberId)].first_name} ${familyMembersInfo[String(memberId)].last_name}`
        : `member #${memberId}`);
      showToast(`Successfully registered ${who} for ${ev.title}.`);
    } catch (err) {
      alert(`Registration failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function loadSignups(force = false) {
    if (allRegs !== null && !force) return;
    setSignupsLoading(true);
    try {
      const [tournData, shinsaData, seminarData, specialData, membersData] = await Promise.all([
        fetch(`${BASE_URL}/events/tournamentRegistrations`).then(r => r.json()).catch(() => ({ body: [] })),
        fetch(`${BASE_URL}/events/shinsaRegistrations`).then(r => r.json()).catch(() => ({ body: [] })),
        fetch(`${BASE_URL}/events/seminarRegistrations`).then(r => r.json()).catch(() => ({ body: [] })),
        fetch(`${BASE_URL}/events/specialEventRegistrations`).then(r => r.json()).catch(() => ({ body: [] })),
        fetch(MEMBERS_API).then(r => r.json()).catch(() => ({ items: [] })),
      ]);
      setAllRegs({
        tournament: tournData.body ?? [],
        shinsa: shinsaData.body ?? [],
        seminar: seminarData.body ?? [],
        special: specialData.body ?? [],
      });
      const map = {};
      for (const m of (membersData.items ?? [])) map[String(m.member_id)] = m;
      setAllMembersMap(map);
    } catch (err) {
      console.error('loadSignups error:', err);
    }
    setSignupsLoading(false);
  }

  function parsePostgresArray(pgStr) {
    if (!pgStr) return [];
    if (Array.isArray(pgStr)) return pgStr; // Already an array

    // Remove the outer curly braces {}
    const cleaned = pgStr.replace(/^\{|\}$/g, '');

    // Split by commas, handling the quotes
    return cleaned.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
      ?.map(val => val.replace(/^"|"$/g, '')) || [];
  }

  function getEventSignups(ev) {
    if (!allRegs) return [];
    const eid = String(ev.event_id);
    if (ev.type === 'tournament') {
      return allRegs.tournament
        .filter(r => String(r.event_id) === eid)
        .map(r => {
          const cleanedDivisions = parsePostgresArray(r.divisions);

          return {
            member: allMembersMap[String(r.member_id)],
            member_id: r.member_id,
            detail: [
              cleanedDivisions.length
                ? cleanedDivisions.join(', ')
                : null,
              r.shinpanning && 'Shinpanning',
              r.doing_teams && 'Teams',
            ]
              .filter(Boolean)
              .join(' · '),
          };
        });
    }
    if (ev.type === 'shinsa') {
      return allRegs.shinsa.filter(r => String(r.event_id) === eid).map(r => ({
        member: allMembersMap[String(r.member_id)],
        member_id: r.member_id,
        detail: r.testing_for ? `Testing: ${r.testing_for}` : '',
      }));
    }
    if (ev.type === 'seminar') {
      return allRegs.seminar.filter(r => String(r.event_id) === eid).map(r => ({
        member: allMembersMap[String(r.member_id)],
        member_id: r.member_id,
        detail: '',
      }));
    }
    if (ev.type === 'special_event') {
      return allRegs.special.filter(r => String(r.event_id) === eid).map(r => ({
        member: allMembersMap[String(r.member_id)],
        member_id: r.member_id,
        detail: '',
      }));
    }
    return [];
  }

  async function handleUnregister(ev) {
    if (isOffHours()) { showToast(OFF_HOURS_MSG); return; }
    setSubmitting(true);
    try {
      const memberId = await resolveMemberId();
      if (memberId == null) return;

      const authHeader = await getAuthHeader();
      const res = await fetch(REGISTER_API, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ config_type: ev.type, event_id: ev.event_id, member_id: memberId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      setRegisteredIds(prev => { const next = new Set(prev); next.delete(ev.event_id); return next; });
      await loadRegistrations();
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

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {[['events', 'Events'], ['signups', "Who's Signed Up"]].map(([val, label]) => (
          <button
            key={val}
            onClick={() => { setViewMode(val); if (val === 'signups') loadSignups(); }}
            style={{
              padding: '5px 16px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600,
              border: viewMode === val ? 'none' : '1px solid var(--border)',
              background: viewMode === val ? '#6ea8fe' : 'transparent',
              color: viewMode === val ? '#1a1a2e' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.12s',
            }}
          >{label}</button>
        ))}
      </div>

      {viewMode === 'events' && <div className={styles.filters}>
        <span className={styles.filtersLabel}>Filter:</span>
        {['All', 'Active', 'Past'].map(f => (
          <button
            key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
            onClick={() => setFilter(f)}
          >{f}</button>
        ))}
      </div>}

      {viewMode === 'signups' && (
        <div className={styles.list}>
          {signupsLoading && <p className={styles.empty}>Loading sign-ups...</p>}
          {!signupsLoading && allRegs && (() => {
            const upcomingEvents = events
              .filter(ev => getStatus(ev.start_datetime, ev.event_end_datetime) === 'Active')
              .sort(compareEvents);
            const eventsWithSignups = upcomingEvents.map(ev => ({ ev, signups: getEventSignups(ev) })).filter(x => x.signups.length > 0);
            if (eventsWithSignups.length === 0) return <p className={styles.empty}>No sign-ups yet.</p>;
            return eventsWithSignups.map(({ ev, signups }) => {
              const { day, month } = formatDateBadge(ev.start_datetime);
              return (
                <div key={ev.event_id} className={styles.card}>
                  <div className={styles.dateBadge}>
                    <span className={styles.dateDay}>{day}</span>
                    <span className={styles.dateMonth}>{month}</span>
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}>
                      <span className={styles.cardTitle}>{ev.title}</span>
                      <span className={styles.typeBadge}>{fmtType(ev.type)}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{signups.length} registered</span>
                    </div>
                    <ul style={{ margin: '0.5rem 0 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {signups.map((s, i) => {
                        const name = s.member ? `${s.member.first_name} ${s.member.last_name}` : `Member #${s.member_id}`;
                        return (
                          <li key={i} style={{ fontSize: '0.875rem', color: 'var(--text-primary)', display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
                            <span style={{ fontWeight: 500 }}>{name}</span>
                            {s.detail && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{s.detail}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {viewMode === 'events' && <div className={styles.list}>
        {loading && <p className={styles.empty}>Loading events...</p>}
        {!loading && isOffHours() && <OffHoursCard />}
        {!isOffHours() && error && <p className={styles.empty}>Error: {error}</p>}
        {!loading && !error && !isOffHours() && filtered.length === 0 && <p className={styles.empty}>No events found.</p>}
        {!loading && filtered.map(ev => {
          const status = getStatus(ev.start_datetime, ev.event_end_datetime);
          const { day, month } = formatDateBadge(ev.start_datetime);
          const dateRange = formatDateRange(ev.start_datetime, ev.event_end_datetime, ev.location);
          const isSigningUp = signingUpId === ev.event_id;
          const isRegistered = registeredIds.has(ev.event_id);
          const cfg = configs[ev.event_id];
          const regCheckFailed = regCheckFailedTypes.has(ev.type);
          const signupClosed = ev.end_datetime && new Date() > new Date(ev.end_datetime);
          const canSignUp = status !== 'Past' && !signupClosed;

          // A parent can keep signing up family members for this event even after
          // registering themselves — so "eligible" excludes only whoever (self or
          // family) is already registered for THIS specific event, not everyone.
          const familyIsParent = family.is_parent && (family.members?.length ?? 0) > 1;
          const familySignedUpIds = familyIsParent
            ? new Set(getEventSignups(ev).map(s => Number(s.member_id)))
            : new Set();
          const eligibleFamilyMembers = familyIsParent
            ? (family.members ?? [])
                .filter(m => Number(m.member_id) !== Number(memberIdRef.current))
                .filter(m => !familySignedUpIds.has(Number(m.member_id)))
            : [];
          const targetOptions = [
            ...(!isRegistered ? [{ member_id: memberIdRef.current, label: 'Me' }] : []),
            ...eligibleFamilyMembers.map(m => ({
              member_id: m.member_id,
              label: familyMembersInfo?.[String(m.member_id)]
                ? `${familyMembersInfo[String(m.member_id)].first_name} ${familyMembersInfo[String(m.member_id)].last_name}`
                : `Member #${m.member_id}`,
            })),
          ];
          const hasSignupTarget = targetOptions.length > 0;

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
                    selfId={memberIdRef.current}
                    targetOptions={targetOptions}
                    familyMembersInfo={familyMembersInfo}
                    paymentMap={paymentMap}
                    onSubmit={(extra, targetMemberId) => handleSignUpSubmit(ev, extra, targetMemberId)}
                    onCancel={() => setSigningUpId(null)}
                    submitting={submitting}
                  />
                ) : (
                  <>
                    <div className={styles.cardTop}>
                      <span className={styles.cardTitle}>{ev.title}</span>
                      <span className={styles.badge} style={{ backgroundColor: STATUS_COLORS[status] }}>{status}</span>
                      <span className={styles.typeBadge}>{fmtType(ev.type)}</span>
                      {!regCheckFailed && isRegistered && (
                        <span className={styles.badge} style={{ backgroundColor: '#157347' }}>Registered</span>
                      )}
                      {regCheckFailed && (
                        <span className={styles.badge} style={{ backgroundColor: '#856404' }}>Status unknown</span>
                      )}
                    </div>
                    <p className={styles.cardMeta}>{dateRange}</p>
                    {ev.end_datetime && (
                      <p className={styles.cardMeta}>Sign up by {formatDateTime(ev.end_datetime)}</p>
                    )}
                    {ev.description && (
                      <details>
                        <summary className={styles.mapsLink} style={{ cursor: 'pointer' }}>Description</summary>
                        <p className={styles.cardDesc}>{ev.description}</p>
                      </details>
                    )}
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
                          {cfg.payment_required && cfg.payment_options?.length > 0 && (
                            <div className={styles.configRow}>
                              <span className={styles.configLabel}>Payment Options</span>
                              <div className={styles.configTags}>
                                {cfg.payment_options.map(o => {
                                  const pay = paymentMap[String(o.payment_id)];
                                  const label = pay ? `${pay.title} — $${Number(pay.payment_value ?? 0).toFixed(2)}` : `Payment #${o.payment_id}`;
                                  const restriction = o.restriction_type === 'at_most' ? ` (age ≤ ${o.age_limit})`
                                    : o.restriction_type === 'below' ? ` (age < ${o.age_limit})`
                                    : o.restriction_type === 'at_least' ? ` (age ≥ ${o.age_limit})`
                                    : '';
                                  return <span key={o.payment_id} className={styles.configTag}>{label}{restriction}</span>;
                                })}
                              </div>
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
                    {ev.payment_id && paymentDataFailed && (
                      <div className={styles.paymentRow}>
                        <span className={styles.paymentIcon}>⚠️</span>
                        <span className={styles.paymentTitle}>Couldn't verify payment status</span>
                        <button
                          className={styles.payNowBtn}
                          disabled={retryingRegistrations}
                          onClick={retryRegistrationCheck}
                        >
                          {retryingRegistrations ? 'Retrying...' : 'Retry'}
                        </button>
                      </div>
                    )}
                    {ev.payment_id && !paymentDataFailed && paymentMap[String(ev.payment_id)] && (() => {
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
                      {canSignUp && regCheckFailed && (
                        <div className={styles.externalConfirm}>
                          <span className={styles.fieldError}>Couldn't verify your registration status.</span>
                          <button
                            className={styles.signupBtn}
                            disabled={retryingRegistrations}
                            onClick={retryRegistrationCheck}
                          >
                            {retryingRegistrations ? 'Retrying...' : 'Retry'}
                          </button>
                        </div>
                      )}
                      {canSignUp && !regCheckFailed && hasSignupTarget && configErrorIds.has(ev.event_id) && (
                        <div className={styles.externalConfirm}>
                          <span className={styles.fieldError}>Couldn't load event details.</span>
                          <button
                            className={styles.signupBtn}
                            disabled={retryingConfigIds.has(ev.event_id)}
                            onClick={() => retryEventConfig(ev)}
                          >
                            {retryingConfigIds.has(ev.event_id) ? 'Retrying...' : 'Retry'}
                          </button>
                        </div>
                      )}
                      {canSignUp && !regCheckFailed && hasSignupTarget && !configErrorIds.has(ev.event_id) && !externalClickedIds.has(ev.event_id) && (
                        <button className={styles.signupBtn} onClick={() => handleSignUpClick(ev)}>
                          {isRegistered ? 'Sign Up Family Member' : 'Sign Up'}
                        </button>
                      )}
                      {canSignUp && !regCheckFailed && hasSignupTarget && !configErrorIds.has(ev.event_id) && externalClickedIds.has(ev.event_id) && (
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
                            {' '}I intend on signing up on the external form
                          </label>
                          <div className={styles.externalActions}>
                            <button
                              className={styles.signupBtn}
                              disabled={!externalChecked.has(ev.event_id)}
                              onClick={() => setSigningUpId(ev.event_id)}
                            >
                              Register my intent
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
                      {status !== 'Past' && !canSignUp && !regCheckFailed && !isRegistered && (
                        <span className={styles.cardMeta}>Registration closed</span>
                      )}
                      {!regCheckFailed && isRegistered && (
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
      </div>}
    </div>
  );
}

export default EventsSignup;
