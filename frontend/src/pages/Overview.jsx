import { useState, useEffect } from 'react';
import { userManager } from '../js/cognitoManager';
import { mapWithConcurrency } from '../js/shared/concurrency';
import { fetchJsonSafe } from '../js/shared/fetchSafe';

const BASE_URL = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';
const MEMBERS_API = `${BASE_URL}/members`;
const EVENTS_API = `${BASE_URL}/events`;
const TOURNAMENT_REGS_API = `${BASE_URL}/events/tournamentRegistrations`;
const SHINSA_REGS_API = `${BASE_URL}/events/shinsaRegistrations`;
const SEMINAR_REGS_API = `${BASE_URL}/events/seminarRegistrations`;
const SPECIAL_EVENT_REGS_API = `${BASE_URL}/events/specialEventRegistrations`;
const ASSIGNED_PAYMENTS_API = `${BASE_URL}/assignedpayments`;
const PAYMENTS_API = `${BASE_URL}/payments`;
const ANNOUNCEMENTS_API = `${BASE_URL}/announcements`;

const EVENT_TYPE_STYLES = {
  tournament: { background: '#1a2744', color: '#6ea8fe' },
  shinsa: { background: '#2e1d0e', color: '#fd9843' },
  seminar: { background: '#0d3321', color: '#75b798' },
};

const S = {
  page: { padding: '2%', background: '#1a1a2e', minHeight: '100vh', color: '#fff' },
  welcome: { fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.75rem', color: '#e8e8f0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', alignItems: 'start' },
  card: { background: '#22223a', border: '1px solid #2e2e50', borderRadius: '12px', padding: '1.25rem 1.5rem' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  cardTitle: { fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b6b9a' },
  cardCount: { fontSize: '0.85rem', color: '#87ceeb', fontWeight: 600 },
  row: { display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.6rem 0', borderBottom: '1px solid #2e2e50' },
  rowLast: { display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.6rem 0' },
  badge: (type) => ({ ...EVENT_TYPE_STYLES[type] ?? EVENT_TYPE_STYLES.seminar, borderRadius: '5px', padding: '0.15rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }),
  eventName: { fontSize: '0.9rem', color: '#e8e8f0', fontWeight: 500 },
  eventMeta: { fontSize: '0.75rem', color: '#6b6b9a', marginTop: '0.1rem' },
  emptyText: { color: '#6b6b9a', fontStyle: 'italic', fontSize: '0.88rem', padding: '0.25rem 0' },
  linkBtn: { display: 'inline-block', marginTop: '1rem', background: 'none', border: 'none', color: '#6ea8fe', cursor: 'pointer', fontSize: '0.82rem', padding: 0 },
  payTitle: { fontSize: '0.9rem', color: '#e8e8f0', fontWeight: 500, flex: 1 },
  payRight: { textAlign: 'right', flexShrink: 0 },
  payAmount: { fontSize: '0.9rem', color: '#e8e8f0', fontWeight: 600 },
  payDue: (overdue) => ({ fontSize: '0.75rem', color: overdue ? '#dc3545' : '#6b6b9a', marginTop: '0.1rem' }),
  overdueBadge: { background: '#3d0a0a', color: '#dc3545', border: '1px solid #dc354555', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.7rem', fontWeight: 700 },
  annSubject: { fontSize: '0.95rem', fontWeight: 600, color: '#e8e8f0', marginBottom: '0.4rem' },
  annDate: { fontSize: '0.75rem', color: '#6b6b9a', marginBottom: '0.6rem' },
  annBody: { fontSize: '0.85rem', color: '#bbb', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap' },
};

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
}

const REGISTRATION_TYPE_ENDPOINTS = [
  { type: 'tournament', url: TOURNAMENT_REGS_API },
  { type: 'shinsa', url: SHINSA_REGS_API },
  { type: 'seminar', url: SEMINAR_REGS_API },
  { type: 'special_event', url: SPECIAL_EVENT_REGS_API },
];

export default function Overview({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [latestAnnouncement, setLatestAnnouncement] = useState(null);
  const [regCheckFailedTypes, setRegCheckFailedTypes] = useState(new Set());
  const [retrying, setRetrying] = useState(false);

  async function load() {
    const user = await userManager.getUser();
    if (!user || user.expired) { setLoading(false); return; }

    const username = user.profile?.preferred_username;
    if (!username) { setLoading(false); return; }

    try {
      const usernameRes = await fetch(`${MEMBERS_API}?username=${encodeURIComponent(username)}`);
      const usernameData = await usernameRes.json();
      const memberId = usernameData.items?.[0]?.member_id;
      if (!memberId) return;

      const fullRes = await fetch(`${MEMBERS_API}?member_id=${memberId}`);
      const fullData = await fullRes.json();
      const me = fullData.items?.[0];
      if (me?.first_name) setFirstName(me.first_name);

      const fetchers = [
        ...REGISTRATION_TYPE_ENDPOINTS.map(e => () => fetchJsonSafe(e.url)),
        () => fetch(EVENTS_API).then(r => r.json()).catch(() => ({ body: [] })),
        () => fetch(ASSIGNED_PAYMENTS_API).then(r => r.json()).catch(() => ({ data: [] })),
        () => fetch(PAYMENTS_API).then(r => r.json()).catch(() => ({ data: [] })),
        () => fetch(ANNOUNCEMENTS_API).then(r => r.json()).catch(() => ({ announcements: [] })),
      ];
      const results = await mapWithConcurrency(fetchers, 4, fn => fn());
      const [tourneyR, shinsaR, seminarR, specialEventR, evData, asgnData, payData, annData] = results;

      setRegCheckFailedTypes(new Set(
        REGISTRATION_TYPE_ENDPOINTS.filter((_, i) => results[i].failed).map(e => e.type)
      ));

      const tourneyData = tourneyR.data ?? { body: [] };
      const shinsaData = shinsaR.data ?? { body: [] };
      const seminarData = seminarR.data ?? { body: [] };
      const specialEventData = specialEventR.data ?? { body: [] };

      const mid = Number(memberId);
      const todayStr = new Date().toISOString().slice(0, 10);

      const eventMap = Object.fromEntries((evData.body ?? []).map(e => [String(e.event_id), e]));

      const allRegs = [
        ...(tourneyData.body ?? []).filter(r => Number(r.member_id) === mid).map(r => ({ event_id: r.event_id, type: 'tournament' })),
        ...(shinsaData.body ?? []).filter(r => Number(r.member_id) === mid).map(r => ({ event_id: r.event_id, type: 'shinsa' })),
        ...(seminarData.body ?? []).filter(r => Number(r.member_id) === mid).map(r => ({ event_id: r.event_id, type: 'seminar' })),
        ...(specialEventData.body ?? []).filter(r => Number(r.member_id) === mid).map(r => ({ event_id: r.event_id, type: 'special_event' })),
      ];

      const upcoming = allRegs
        .map(r => {
          const ev = eventMap[String(r.event_id)];
          if (!ev) return null;
          return { ...ev, type: r.type, dateStr: new Date(ev.event_date).toISOString().slice(0, 10) };
        })
        .filter(ev => ev && ev.dateStr >= todayStr)
        .sort((a, b) => a.dateStr.localeCompare(b.dateStr));

      setUpcomingEvents(upcoming);

      const paymentMap = Object.fromEntries((payData.data ?? []).map(p => [String(p.payment_id), p]));
      const pending = (asgnData.data ?? [])
        .filter(a => Number(a.member_id) === mid)
        .map(a => ({ ...a, ...paymentMap[String(a.payment_id)] }))
        .sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date) - new Date(b.due_date);
        });

      setPendingPayments(pending);

      const announcements = (annData.announcements ?? [])
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setLatestAnnouncement(announcements[0] ?? null);
    } catch (err) {
      console.error('[overview] load failed:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function retryRegistrationCheck() {
    setRetrying(true);
    await load();
    setRetrying(false);
  }

  if (loading) {
    return (
      <div style={S.page}>
        <p style={{ color: '#6b6b9a' }}>Loading...</p>
      </div>
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div style={S.page}>
      <h2 style={S.welcome}>
        {firstName ? `Welcome back, ${firstName}!` : 'Welcome back!'}
      </h2>

      <div style={S.grid}>

        {/* Upcoming Events */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>Upcoming Events</span>
            <span style={S.cardCount}>{upcomingEvents.length}</span>
          </div>

          {regCheckFailedTypes.size > 0 && (
            <div style={{ ...S.emptyText, fontStyle: 'normal', color: '#fd9843', marginBottom: '0.6rem' }}>
              ⚠️ Couldn't verify some registrations — this list may be incomplete.{' '}
              <button
                style={{ ...S.linkBtn, marginTop: 0 }}
                disabled={retrying}
                onClick={retryRegistrationCheck}
              >
                {retrying ? 'Retrying...' : 'Retry'}
              </button>
            </div>
          )}

          {upcomingEvents.length === 0
            ? <p style={S.emptyText}>No upcoming events signed up.</p>
            : upcomingEvents.map((ev, i) => (
              <div key={ev.event_id} style={i === upcomingEvents.length - 1 ? S.rowLast : S.row}>
                <span style={S.badge(ev.type)}>
                  {ev.type.charAt(0).toUpperCase() + ev.type.slice(1)}
                </span>
                <div>
                  <div style={S.eventName}>{ev.event_name}</div>
                  <div style={S.eventMeta}>
                    {formatDate(ev.event_date)}
                    {ev.event_location ? ` · ${ev.event_location}` : ''}
                  </div>
                </div>
              </div>
            ))
          }

          <button style={S.linkBtn} onClick={() => onNavigate('Events')}>
            View all events →
          </button>
        </div>

        {/* Pending Payments */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>Pending Payments</span>
            <span style={S.cardCount}>{pendingPayments.length}</span>
          </div>

          {pendingPayments.length === 0
            ? <p style={S.emptyText}>No pending payments.</p>
            : pendingPayments.map((p, i) => {
              const dueDateStr = p.due_date ? new Date(p.due_date).toISOString().slice(0, 10) : '';
              const isOverdue = !!dueDateStr && todayStr > dueDateStr;
              const base = Number(p.payment_value ?? 0);
              const penalty = isOverdue && p.overdue_penalty ? Number(p.overdue_penalty) : 0;
              const total = base + penalty;
              return (
                <div key={p.payment_id} style={i === pendingPayments.length - 1 ? S.rowLast : S.row}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={S.payTitle}>{p.title ?? `Payment #${p.payment_id}`}</span>
                      {isOverdue && <span style={S.overdueBadge}>overdue</span>}
                    </div>
                    {p.due_date && (
                      <div style={S.payDue(isOverdue)}>
                        Due {formatDate(p.due_date)}
                      </div>
                    )}
                  </div>
                  <div style={S.payRight}>
                    <div style={S.payAmount}>${total.toFixed(2)}</div>
                    {penalty > 0 && (
                      <div style={{ fontSize: '0.7rem', color: '#dc3545' }}>+${penalty.toFixed(2)} penalty</div>
                    )}
                  </div>
                </div>
              );
            })
          }

          <button style={S.linkBtn} onClick={() => onNavigate('Pay')}>
            Go to payments →
          </button>
        </div>

        {/* Latest Announcement */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>Latest Announcement</span>
          </div>

          {!latestAnnouncement
            ? <p style={S.emptyText}>No announcements yet.</p>
            : (
              <>
                <div style={S.annSubject}>{latestAnnouncement.subject}</div>
                <div style={S.annDate}>{formatDate(latestAnnouncement.created_at)}</div>
                <div style={S.annBody}>{latestAnnouncement.body}</div>
              </>
            )
          }

          <button style={S.linkBtn} onClick={() => onNavigate('Announcements')}>
            View all announcements →
          </button>
        </div>

      </div>
    </div>
  );
}
