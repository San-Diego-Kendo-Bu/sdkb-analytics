import { useState, useEffect } from 'react';
import { userManager } from '../js/cognitoManager';
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
    if (reg.weight != null) details.push(['Weight', `${reg.weight} lbs`]);
    if (reg.height != null) {
      const ft = Math.floor(reg.height / 12);
      const inches = reg.height % 12;
      details.push(['Height', `${ft}'${inches}"`]);
    }
    if (reg.age != null) details.push(['Age', String(reg.age)]);
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

function FilterToggle({ showAll, onToggle }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
      {['Active', 'All'].map(label => (
        <button key={label} onClick={() => onToggle(label === 'All')}
          style={{
            fontSize: '0.8rem', padding: '4px 14px', borderRadius: 16, cursor: 'pointer',
            fontWeight: (label === 'All') === showAll ? 700 : 400,
            border: (label === 'All') === showAll ? 'none' : '1px solid #3a3a52',
            background: (label === 'All') === showAll ? '#6ea8fe' : 'transparent',
            color: (label === 'All') === showAll ? '#1a1a2e' : '#aaa',
            transition: 'all 0.12s',
          }}
        >{label}</button>
      ))}
    </div>
  );
}

function EventsTab({ bins, memberMap, onSelect }) {
  const [showAll, setShowAll] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const visible = showAll
    ? bins
    : bins.filter(({ event }) => !event.event_date || event.event_date.slice(0, 10) >= today);

  if (bins.length === 0) {
    return <p className="text-muted mt-3">No event signups yet.</p>;
  }
  return (
    <div>
      <FilterToggle showAll={showAll} onToggle={setShowAll} />
      {visible.length === 0
        ? <p style={{ color: '#888', padding: '2rem 0', textAlign: 'center' }}>No active event signups.</p>
        : <div className={styles.binGrid}>
            {visible.map(({ event, regs }) => {
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
      }
    </div>
  );
}

function UnassignableTag({ label, color, bg, onUnassign }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: bg, color, borderRadius: 8, padding: '2px 6px 2px 8px',
      fontSize: '0.82rem', fontWeight: 500,
    }}>
      {label}
      <button
        onClick={onUnassign}
        title="Unassign"
        style={{
          background: 'none', border: 'none', color, cursor: 'pointer',
          padding: '0 1px', lineHeight: 1, opacity: 0.7, fontSize: '0.9rem',
        }}
      >×</button>
    </span>
  );
}

function PaymentsTab({ bins, onUnassign }) {
  const [showAll, setShowAll] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const visible = showAll
    ? bins
    : bins.filter(({ payment, assigned }) => {
        const isPastDue = payment.due_date ? today > payment.due_date.slice(0, 10) : false;
        const hasOverdue = assigned.some(a => a.isOverdue);
        return !isPastDue || hasOverdue;
      });

  if (bins.length === 0) {
    return <p className="text-muted mt-3">No payment data yet.</p>;
  }
  return (
    <div>
      <FilterToggle showAll={showAll} onToggle={setShowAll} />
      {visible.length === 0
        ? <p style={{ color: '#888', padding: '2rem 0', textAlign: 'center' }}>No active payments.</p>
        : <div className={styles.paymentSection}>
      {visible.map(({ payment, assigned, submitted }) => {
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
                    <UnassignableTag
                      key={i}
                      label={a.member ? `${a.member.first_name} ${a.member.last_name}` : `Member #${a.member_id}`}
                      color="#f5a8a8"
                      bg="#2a0e0e"
                      onUnassign={() => onUnassign(a.member_id, payment.payment_id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {due.length > 0 && (
              <div className={styles.paymentGroup}>
                <span className={styles.groupLabel} style={{ background: '#2a1d0e', color: '#f0c060' }}>Due</span>
                <div className={styles.memberTags}>
                  {due.map((a, i) => (
                    <UnassignableTag
                      key={i}
                      label={a.member ? `${a.member.first_name} ${a.member.last_name}` : `Member #${a.member_id}`}
                      color="#f0c060"
                      bg="#2a1d0e"
                      onUnassign={() => onUnassign(a.member_id, payment.payment_id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
        </div>
      }
    </div>
  );
}

function formatRank(rank_type, rank_number) {
  if (!rank_type) return '—';
  const num = rank_number != null ? String(rank_number) : '';
  return num ? `${num} ${rank_type}` : rank_type;
}

const DIR_FILTERS = [
  { key: 'active',   label: 'All Active' },
  { key: 'senseis',  label: 'Senseis (4-Dan+)' },
  { key: 'guests',   label: 'Guests' },
  { key: 'inactive', label: 'Inactive' },
];

function matchesDirFilter(m, filter) {
  if (filter === 'active')   return m.status !== 'inactive' && m.status !== 'guest';
  if (filter === 'senseis')  return m.rank_type === 'shihan' || (m.rank_type === 'dan' && Number(m.rank_number) >= 4);
  if (filter === 'guests')   return m.status === 'guest';
  if (filter === 'inactive') return m.status === 'inactive';
  return true;
}

function DirectoryTab({ members, onToggleStatus, onToggleStudent }) {
  const [search, setSearch] = useState('');
  const [dirFilter, setDirFilter] = useState('active');

  const filtered = members
    .filter(m => matchesDirFilter(m, dirFilter))
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
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {DIR_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setDirFilter(f.key)}
            style={{
              fontSize: '0.8rem',
              padding: '4px 14px',
              borderRadius: 16,
              border: dirFilter === f.key ? 'none' : '1px solid #3a3a52',
              cursor: 'pointer',
              fontWeight: dirFilter === f.key ? 700 : 400,
              background: dirFilter === f.key ? '#6ea8fe' : 'transparent',
              color: dirFilter === f.key ? '#1a1a2e' : '#aaa',
              transition: 'all 0.12s',
            }}
          >{f.label}</button>
        ))}
      </div>
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
          <div className={styles.dirHeader}>
            <span>Name</span>
            <span className={styles.dirCellHide}>Rank</span>
            <span className={styles.dirCellHide}>Email</span>
            <span className={styles.dirCellHide}>Birthday</span>
            <span>Status</span>
            <span>College Student</span>
          </div>
          {filtered.map(m => (
            <div key={m.member_id} className={styles.dirRow}>
              <span style={{ fontWeight: 500, color: '#fff' }}>
                {m.last_name}, {m.first_name}
                {m.status === 'guest' && (
                  <span style={{ marginLeft: 6, fontSize: '0.7rem', background: '#2e1d0e', color: '#fd9843', borderRadius: 8, padding: '1px 6px', fontWeight: 700 }}>
                    Guest
                  </span>
                )}
              </span>
              <span className={styles.dirCellHide} style={{ color: '#ccc' }}>{formatRank(m.rank_type, m.rank_number)}</span>
              <span className={styles.dirCellHide} style={{ color: '#888', fontSize: '0.82rem' }}>
                {m.email ? (
                  <a href={`mailto:${m.email}`} style={{ color: '#6ea8fe', textDecoration: 'none' }}>{m.email}</a>
                ) : '—'}
              </span>
              <span className={styles.dirCellHide} style={{ color: '#888', fontSize: '0.82rem' }}>
                {m.birthday
                  ? new Date(m.birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
                  : '—'}
              </span>
              <span>
                {m.status === 'guest' ? (
                  <span style={{ fontSize: '0.72rem', background: '#2e1d0e', color: '#fd9843', borderRadius: 8, padding: '2px 8px', fontWeight: 700 }}>Guest</span>
                ) : (
                  <div
                    onClick={() => onToggleStatus(m, m.status === 'inactive' ? 'active' : 'inactive')}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{
                      width: 36, height: 20, borderRadius: 10,
                      background: m.status === 'inactive' ? '#3a3a52' : '#157347',
                      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    }}>
                      <div style={{
                        position: 'absolute', top: 2,
                        left: m.status === 'inactive' ? 2 : 18,
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#fff', transition: 'left 0.2s',
                      }} />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: m.status === 'inactive' ? '#888' : '#75b798', fontWeight: 600 }}>
                      {m.status === 'inactive' ? 'Inactive' : 'Active'}
                    </span>
                  </div>
                )}
              </span>
              <span>
                <div
                  onClick={() => onToggleStudent(m, !m.is_student)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{
                    width: 36, height: 20, borderRadius: 10,
                    background: m.is_student ? '#1565c0' : '#3a3a52',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}>
                    <div style={{
                      position: 'absolute', top: 2,
                      left: m.is_student ? 18 : 2,
                      width: 16, height: 16, borderRadius: '50%',
                      background: '#fff', transition: 'left 0.2s',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.72rem', color: m.is_student ? '#6ea8fe' : '#888', fontWeight: 600 }}>
                    {m.is_student ? 'Yes' : 'No'}
                  </span>
                </div>
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
              isOverdue: p.due_date ? new Date().toISOString().slice(0, 10) > p.due_date.slice(0, 10) : a.due_status === 'overdue',
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

  async function handleUnassign(memberId, paymentId) {
    try {
      const user = await userManager.getUser();
      const res = await fetch(ASSIGNED_API, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id_token}` },
        body: JSON.stringify({ member_id: memberId, payment_id: paymentId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOverview(prev => ({
        ...prev,
        paymentBins: prev.paymentBins
          .map(b => String(b.payment.payment_id) === String(paymentId)
            ? { ...b, assigned: b.assigned.filter(a => String(a.member_id) !== String(memberId)) }
            : b
          )
          .filter(b => b.assigned.length > 0 || b.submitted.length > 0),
      }));
    } catch (err) {
      console.error('unassign error:', err);
    }
  }

  async function handleToggleStudent(member, newValue) {
    try {
      const user = await userManager.getUser();
      const res = await fetch(MEMBERS_API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id_token}` },
        body: JSON.stringify({
          member_id: member.member_id,
          first_name: member.first_name,
          last_name: member.last_name,
          zekken_text: member.zekken_text,
          rank_type: member.rank_type,
          rank_number: member.rank_number,
          email: member.email,
          birthday: member.birthday || null,
          status: member.status,
          is_student: newValue,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAllMembers(prev => prev.map(m =>
        m.member_id === member.member_id ? { ...m, is_student: newValue } : m
      ));
    } catch (err) {
      console.error('toggleStudent error:', err);
    }
  }

  async function handleToggleStatus(member, newStatus) {
    try {
      const user = await userManager.getUser();
      const res = await fetch(MEMBERS_API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id_token}` },
        body: JSON.stringify({
          member_id: member.member_id,
          first_name: member.first_name,
          last_name: member.last_name,
          zekken_text: member.zekken_text,
          rank_type: member.rank_type,
          rank_number: member.rank_number,
          email: member.email,
          birthday: member.birthday || null,
          status: newStatus,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAllMembers(prev => prev.map(m =>
        m.member_id === member.member_id ? { ...m, status: newStatus } : m
      ));
    } catch (err) {
      console.error('toggleStatus error:', err);
    }
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
        <PaymentsTab bins={overview.paymentBins} onUnassign={handleUnassign} />
      )}
      {tab === 'directory' && (
        <DirectoryTab members={allMembers} onToggleStatus={handleToggleStatus} onToggleStudent={handleToggleStudent} />
      )}

      {selected && <MemberModal selection={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
