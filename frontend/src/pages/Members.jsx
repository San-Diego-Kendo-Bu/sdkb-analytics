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
  tournament: { bg: '#cfe2ff', border: '#0d6efd', text: '#0a58ca', badgeBg: '#0d6efd' },
  shinsa:     { bg: '#ffe5d0', border: '#fd7e14', text: '#974d00', badgeBg: '#fd7e14' },
  seminar:    { bg: '#d1e7dd', border: '#198754', text: '#0f5132', badgeBg: '#198754' },
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
                <span className={styles.groupLabel} style={{ background: '#d1e7dd', color: '#0f5132' }}>Paid</span>
                <div className={styles.memberTags}>
                  {submitted.map((s, i) => (
                    <span key={i} className={styles.memberTag} style={{ background: '#d1e7dd', color: '#0f5132' }}>
                      {s.member ? `${s.member.first_name} ${s.member.last_name}` : `Member #${s.member_id}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {overdue.length > 0 && (
              <div className={styles.paymentGroup}>
                <span className={styles.groupLabel} style={{ background: '#fde8e8', color: '#842029' }}>Overdue</span>
                <div className={styles.memberTags}>
                  {overdue.map((a, i) => (
                    <span key={i} className={styles.memberTag} style={{ background: '#fde8e8', color: '#842029' }}>
                      {a.member ? `${a.member.first_name} ${a.member.last_name}` : `Member #${a.member_id}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {due.length > 0 && (
              <div className={styles.paymentGroup}>
                <span className={styles.groupLabel} style={{ background: '#fff3cd', color: '#664d03' }}>Due</span>
                <div className={styles.memberTags}>
                  {due.map((a, i) => (
                    <span key={i} className={styles.memberTag} style={{ background: '#fff3cd', color: '#664d03' }}>
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

export default function Members() {
  const [tab, setTab]             = useState('events');
  const [overview, setOverview]   = useState(null);
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

      setOverview({ eventBins, paymentBins, memberMap });
    } catch (err) {
      console.error('Members load error:', err);
    }
    setLoading(false);
  }

  if (loading) return <p className="text-muted p-3">Loading...</p>;
  if (!overview) return <p className="text-muted p-3">Failed to load data.</p>;

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'events' ? styles.activeTab : ''}`} onClick={() => setTab('events')}>
          Event Signups
        </button>
        <button className={`${styles.tab} ${tab === 'payments' ? styles.activeTab : ''}`} onClick={() => setTab('payments')}>
          Payments
        </button>
      </div>

      {tab === 'events' && (
        <EventsTab bins={overview.eventBins} memberMap={overview.memberMap} onSelect={setSelected} />
      )}
      {tab === 'payments' && (
        <PaymentsTab bins={overview.paymentBins} />
      )}

      {selected && <MemberModal selection={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
