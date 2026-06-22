import { useState, useEffect } from 'react';
import styles from '../../css/members.module.css';

const BASE_URL        = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';
const MEMBERS_API     = `${BASE_URL}/members`;
const EVENTS_API      = `${BASE_URL}/events`;
const TOURNAMENT_API  = `${BASE_URL}/events/tournamentRegistrations`;
const SHINSA_API      = `${BASE_URL}/events/shinsaRegistrations`;
const SEMINAR_API     = `${BASE_URL}/events/seminarRegistrations`;
const ASSIGNED_API    = `${BASE_URL}/assignedpayments`;
const SUBMITTED_API   = `${BASE_URL}/submittedpayments`;
const PAYMENTS_API    = `${BASE_URL}/payments`;

const TYPE_STYLE = {
  tournament: { bg: '#1a2744', border: '#0d6efd', text: '#6ea8fe', badgeBg: '#0d6efd' },
  shinsa:     { bg: '#2e1d0e', border: '#fd7e14', text: '#fd9843', badgeBg: '#fd7e14' },
  seminar:    { bg: '#0e2a1a', border: '#198754', text: '#75b798', badgeBg: '#198754' },
};

function getRegSummary(r) {
  if (r._type === 'tournament') {
    const parts = [];
    if (r.division) parts.push(r.division);
    if (r.shinpanning) parts.push('Shinpanning');
    if (r.doing_teams) parts.push('Teams');
    return parts.join(' · ');
  }
  if (r._type === 'shinsa') return r.testing_for ? `Testing: ${r.testing_for}` : '';
  return '';
}

function MemberModal({ selection, onClose }) {
  const { member, event, reg } = selection;
  const name = member ? `${member.first_name} ${member.last_name}` : `Member #${reg.member_id}`;
  const ts = TYPE_STYLE[reg._type] ?? TYPE_STYLE.seminar;

  const details = [];
  if (reg.registration_date) {
    details.push(['Registered', new Date(reg.registration_date).toLocaleDateString('en-US', { timeZone: 'UTC' })]);
  }
  if (reg._type === 'tournament') {
    details.push(['Division',      reg.division    ?? '—']);
    details.push(['Shinpanning',   reg.shinpanning  ? 'Yes' : 'No']);
    details.push(['Doing Teams',   reg.doing_teams  ? 'Yes' : 'No']);
  } else if (reg._type === 'shinsa') {
    details.push(['Testing For', reg.testing_for ?? '—']);
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalName}>{name}</div>
            <div className={styles.modalEvent}>
              <span
                style={{
                  background: ts.badgeBg,
                  color: '#fff',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '1px 7px',
                  borderRadius: 8,
                  marginRight: 6,
                }}
              >
                {reg._type}
              </span>
              {event.event_name}
            </div>
          </div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <dl className={styles.detailGrid}>
          {details.map(([k, v]) => (
            <>
              <dt key={`k-${k}`} className={styles.detailKey}>{k}</dt>
              <dd key={`v-${k}`} className={styles.detailVal}>{String(v)}</dd>
            </>
          ))}
        </dl>
      </div>
    </div>
  );
}

function EventsTab({ bins, memberMap, onSelect }) {
  if (bins.length === 0) {
    return <p className="text-muted mt-3">No event signups yet.</p>;
  }
  return (
    <div className={styles.binGrid}>
      {bins.map(({ event, regs }) => {
        const ts = TYPE_STYLE[event.event_type] ?? TYPE_STYLE.seminar;
        return (
          <div key={event.event_id} className={styles.eventBin} style={{ borderColor: ts.border }}>
            <div className={styles.eventHeader} style={{ background: ts.bg }}>
              <span className={styles.typeBadge} style={{ background: ts.badgeBg, color: '#fff' }}>
                {event.event_type}
              </span>
              <span className={styles.eventName} style={{ color: ts.text }}>{event.event_name}</span>
              {event.event_date && (
                <span className={styles.eventDate}>
                  {new Date(event.event_date).toLocaleDateString('en-US', {
                    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </span>
              )}
            </div>
            <ul className={styles.memberList}>
              {regs.map((r, i) => {
                const m = memberMap[String(r.member_id)];
                const name = m ? `${m.first_name} ${m.last_name}` : `Member #${r.member_id}`;
                const summary = getRegSummary(r);
                return (
                  <li key={i} className={styles.memberRow} onClick={() => onSelect({ reg: r, event, member: m })}>
                    <span className={styles.memberName}>{name}</span>
                    {summary && <span className={styles.detailHint}>{summary}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function PaymentsTab({ bins }) {
  if (bins.length === 0) {
    return <p className="text-muted mt-3">No payment data yet.</p>;
  }
  return (
    <div className={styles.paymentSection}>
      {bins.map(({ payment, assigned, submitted }) => {
        const overdue = assigned.filter(a => a.isOverdue);
        const due     = assigned.filter(a => !a.isOverdue);
        return (
          <div key={payment.payment_id} className={styles.paymentBin}>
            <div className={styles.paymentHeader}>
              <strong>{payment.title ?? `Payment #${payment.payment_id}`}</strong>
              <span className={styles.paymentValue}>${Number(payment.payment_value).toFixed(2)}</span>
              {payment.due_date && (
                <span className={styles.paymentDue}>
                  Due {new Date(payment.due_date).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                </span>
              )}
            </div>

            {submitted.length > 0 && (
              <div className={styles.paymentGroup}>
                <span className={styles.groupLabel} style={{ background: '#0e2a1a', color: '#75b798' }}>Paid</span>
                <div className={styles.memberTags}>
                  {submitted.map((s, i) => (
                    <span key={i} className={styles.memberTag} style={{ background: '#0e2a1a', color: '#75b798' }}>
                      {s.member ? `${s.member.first_name} ${s.member.last_name}` : `Member #${s.member_id}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {overdue.length > 0 && (
              <div className={styles.paymentGroup}>
                <span className={styles.groupLabel} style={{ background: '#2a0e0e', color: '#f5a8a8' }}>Overdue</span>
                <div className={styles.memberTags}>
                  {overdue.map((a, i) => (
                    <span key={i} className={styles.memberTag} style={{ background: '#2a0e0e', color: '#f5a8a8' }}>
                      {a.member ? `${a.member.first_name} ${a.member.last_name}` : `Member #${a.member_id}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {due.length > 0 && (
              <div className={styles.paymentGroup}>
                <span className={styles.groupLabel} style={{ background: '#2a1d0e', color: '#f0c060' }}>Due</span>
                <div className={styles.memberTags}>
                  {due.map((a, i) => (
                    <span key={i} className={styles.memberTag} style={{ background: '#2a1d0e', color: '#f0c060' }}>
                      {a.member ? `${a.member.first_name} ${a.member.last_name}` : `Member #${a.member_id}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatRank(rank_type, rank_number) {
  if (!rank_type) return '—';
  const num = rank_number != null ? String(rank_number) : '';
  return num ? `${num} ${rank_type}` : rank_type;
}

function DirectoryTab({ members }) {
  const [search, setSearch] = useState('');

  const filtered = members
    .filter(m => {
      const q = search.toLowerCase();
      const fullName = `${m.first_name} ${m.last_name}`.toLowerCase();
      return (
        fullName.includes(q) ||
        (m.email ?? '').toLowerCase().includes(q) ||
        formatRank(m.rank_type, m.rank_number).toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const la = (a.last_name ?? '').toLowerCase();
      const lb = (b.last_name ?? '').toLowerCase();
      return la < lb ? -1 : la > lb ? 1 : 0;
    });

  return (
    <div>
      <input
        placeholder="Search by name, rank, or email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          background: '#1a1a2e',
          border: '1px solid #444',
          borderRadius: 6,
          color: '#fff',
          padding: '0.5rem 1rem',
          fontSize: '0.9rem',
          width: '100%',
          maxWidth: 400,
          boxSizing: 'border-box',
          marginBottom: '1rem',
          outline: 'none',
        }}
      />

      {filtered.length === 0 ? (
        <p style={{ color: '#888', padding: '2rem 0', textAlign: 'center' }}>No members found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 140px 1fr',
            padding: '0.5rem 1rem',
            fontSize: '0.75rem',
            color: '#888',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderBottom: '1px solid #3a3a52',
          }}>
            <span>Name</span>
            <span>Rank</span>
            <span>Email</span>
          </div>
          {filtered.map(m => (
            <div key={m.member_id} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 140px 1fr',
              padding: '0.65rem 1rem',
              borderBottom: '1px solid #3a3a52',
              fontSize: '0.875rem',
              alignItems: 'center',
              transition: 'background 0.12s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#1e1e32'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontWeight: 500, color: '#fff' }}>
                {m.last_name}, {m.first_name}
                {m.status === 'guest' && (
                  <span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#2e1d0e', color: '#fd9843', borderRadius: 8, padding: '1px 6px', fontWeight: 700 }}>
                    Guest
                  </span>
                )}
              </span>
              <span style={{ color: '#ccc' }}>{formatRank(m.rank_type, m.rank_number)}</span>
              <span style={{ color: '#888', fontSize: '0.82rem' }}>
                {m.email ? (
                  <a href={`mailto:${m.email}`} style={{ color: '#6ea8fe', textDecoration: 'none' }}>{m.email}</a>
                ) : '—'}
              </span>
            </div>
          ))}
          <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.75rem', textAlign: 'right' }}>
            {filtered.length} member{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

export default function Members() {
  const [tab, setTab]             = useState('events');
  const [overview, setOverview]   = useState(null);
  const [allMembers, setAllMembers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const endpoints = [
        MEMBERS_API, EVENTS_API,
        TOURNAMENT_API, SHINSA_API, SEMINAR_API,
        ASSIGNED_API, SUBMITTED_API, PAYMENTS_API,
      ];

      const settled = await Promise.allSettled(
        endpoints.map(url => fetch(url).then(r => r.json()))
      );

      const labels = ['members','events','tournament','shinsa','seminar','assigned','submitted','payments'];
      settled.forEach((s, i) => {
        if (s.status === 'rejected') console.error(`Members: failed to fetch ${labels[i]}:`, s.reason);
        else console.log(`Members: ${labels[i]}`, s.value);
      });

      const get = i => settled[i].status === 'fulfilled' ? settled[i].value : {};

      const membersData  = get(0);
      const eventsData   = get(1);
      const tournData    = get(2);
      const shinsaData   = get(3);
      const semData      = get(4);
      const assignedData = get(5);
      const submittedData= get(6);
      const paymentsData = get(7);

      const members   = membersData.items   ?? [];
      const events    = eventsData.body     ?? [];
      const tourn     = tournData.body      ?? [];
      const shinsa    = shinsaData.body     ?? [];
      const seminar   = semData.body        ?? [];
      const assigned  = assignedData.data   ?? [];
      const submitted = submittedData.data  ?? [];
      const payments  = paymentsData.data   ?? [];

      const memberMap = Object.fromEntries(members.map(m => [String(m.member_id), m]));

      // Build event bins: group registrations by event_id
      const regsByEventId = {};
      for (const e of events) regsByEventId[e.event_id] = { event: e, regs: [] };

      console.log('Members: event ids in map', Object.keys(regsByEventId));
      console.log('Members: tourn event_ids', tourn.map(r => r.event_id));
      console.log('Members: shinsa event_ids', shinsa.map(r => r.event_id));
      console.log('Members: seminar event_ids', seminar.map(r => r.event_id));

      for (const r of tourn)   regsByEventId[r.event_id]?.regs.push({ ...r, _type: 'tournament' });
      for (const r of shinsa)  regsByEventId[r.event_id]?.regs.push({ ...r, _type: 'shinsa' });
      for (const r of seminar) regsByEventId[r.event_id]?.regs.push({ ...r, _type: 'seminar' });

      const eventBins = Object.values(regsByEventId).filter(b => b.regs.length > 0);
      console.log('Members: eventBins count', eventBins.length, eventBins);

      // Build payment bins: group assigned + submitted by payment_id
      const paymentBins = payments
        .map(p => {
          const myAssigned = assigned
            .filter(a => String(a.payment_id) === String(p.payment_id))
            .map(a => ({
              ...a,
              member: memberMap[String(a.member_id)],
              isOverdue: p.due_date ? new Date() > new Date(p.due_date) : a.due_status === 'overdue',
            }));
          const mySubmitted = submitted
            .filter(s => String(s.payment_id) === String(p.payment_id))
            .map(s => ({ ...s, member: memberMap[String(s.member_id)] }));
          return { payment: p, assigned: myAssigned, submitted: mySubmitted };
        })
        .filter(b => b.assigned.length > 0 || b.submitted.length > 0);

      setAllMembers(members);
      setOverview({ eventBins, paymentBins, memberMap });
    } catch (err) {
      console.error('Members load error:', err);
    }
    setLoading(false);
  }

  if (loading) return <div className={styles.container}><p style={{ color: '#888' }}>Loading...</p></div>;
  if (!overview) return <div className={styles.container}><p style={{ color: '#888' }}>Failed to load data.</p></div>;

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'events' ? styles.activeTab : ''}`} onClick={() => setTab('events')}>
          Event Signups
        </button>
        <button className={`${styles.tab} ${tab === 'payments' ? styles.activeTab : ''}`} onClick={() => setTab('payments')}>
          Payments
        </button>
        <button className={`${styles.tab} ${tab === 'directory' ? styles.activeTab : ''}`} onClick={() => setTab('directory')}>
          Directory
        </button>
      </div>

      {tab === 'events' && (
        <EventsTab bins={overview.eventBins} memberMap={overview.memberMap} onSelect={setSelected} />
      )}
      {tab === 'payments' && (
        <PaymentsTab bins={overview.paymentBins} />
      )}
      {tab === 'directory' && (
        <DirectoryTab members={allMembers} />
      )}

      {selected && <MemberModal selection={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
