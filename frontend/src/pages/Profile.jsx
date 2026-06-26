import { useState, useEffect } from 'react';
import { userManager } from '../js/cognitoManager';
import styles from '../../css/profile.module.css';

const BASE_URL = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';
const MEMBERS_API      = `${BASE_URL}/members`;
const EVENTS_API       = `${BASE_URL}/events`;
const TOURNAMENT_API   = `${BASE_URL}/events/tournamentRegistrations`;
const SHINSA_API       = `${BASE_URL}/events/shinsaRegistrations`;
const SEMINAR_API      = `${BASE_URL}/events/seminarRegistrations`;

const STATUS_COLORS = {
  active:   { bg: '#0d3321', color: '#75b798' },
  exempt:   { bg: '#1a2744', color: '#6ea8fe' },
  inactive: { bg: '#2e2e50', color: '#9898c0' },
  guest:    { bg: '#2e1d0e', color: '#fd9843' },
};

const BREAKDOWN_COLORS = {
  tournament: '#6ea8fe',
  seminar:    '#75b798',
  shinsa:     '#fd9843',
};

function formatRank(rankNumber, rankType) {
  if (!rankType) return '—';
  const type = rankType.charAt(0).toUpperCase() + rankType.slice(1);
  return rankNumber ? `${rankNumber} ${type}` : type;
}

function formatBirthday(birthday) {
  if (!birthday) return '—';
  return new Date(birthday).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
}

function initials(firstName, lastName) {
  return `${(firstName ?? '')[0] ?? ''}${(lastName ?? '')[0] ?? ''}`.toUpperCase();
}

export default function Profile() {
  const [member, setMember] = useState(null);
  const [eventCounts, setEventCounts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const user = await userManager.getUser();
      if (!user || user.expired) { setLoading(false); return; }

      const email = user.profile?.email;
      if (!email) { setLoading(false); return; }

      // Email GSI is KEYS_ONLY — get member_id first, then fetch full record by primary key
      const emailRes = await fetch(`${MEMBERS_API}?email=${encodeURIComponent(email)}`);
      const emailData = await emailRes.json();
      const memberId = emailData.items?.[0]?.member_id;

      if (!memberId) { setLoading(false); return; }

      const [memberRes, eventsRes, tourneyRes, shinsaRes, seminarRes] = await Promise.all([
        fetch(`${MEMBERS_API}?member_id=${memberId}`),
        fetch(EVENTS_API),
        fetch(TOURNAMENT_API),
        fetch(SHINSA_API),
        fetch(SEMINAR_API),
      ]);

      const [memberData, eventsData, tourneyData, shinsaData, seminarData] = await Promise.all([
        memberRes.json(),
        eventsRes.json(),
        tourneyRes.json(),
        shinsaRes.json(),
        seminarRes.json(),
      ]);

      const me = memberData.items?.[0] ?? null;
      setMember(me);

      if (me) {
        const memberId = Number(me.member_id);
        const thisYear = new Date().getFullYear();

        const eventMap = Object.fromEntries(
          (eventsData.body ?? []).map(e => [String(e.event_id), e])
        );

        const inThisYear = (eventId) => {
          const ev = eventMap[String(eventId)];
          if (!ev?.event_date) return false;
          return new Date(ev.event_date).getFullYear() === thisYear;
        };

        const tournaments = (tourneyData.body ?? [])
          .filter(r => Number(r.member_id) === memberId && inThisYear(r.event_id)).length;

        const shinsa = (shinsaData.body ?? [])
          .filter(r => Number(r.member_id) === memberId && inThisYear(r.event_id)).length;

        const seminars = (seminarData.body ?? [])
          .filter(r => Number(r.member_id) === memberId && inThisYear(r.event_id)).length;

        setEventCounts({ tournaments, shinsa, seminars });
      }

      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return <div className={styles.page}><p className={styles.loading}>Loading profile...</p></div>;
  }

  if (!member) {
    return <div className={styles.page}><p className={styles.loading}>Profile not found.</p></div>;
  }

  const statusStyle = STATUS_COLORS[member.status] ?? STATUS_COLORS.inactive;
  const total = eventCounts ? eventCounts.tournaments + eventCounts.shinsa + eventCounts.seminars : 0;
  const thisYear = new Date().getFullYear();

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* Header */}
        <div className={styles.headerCard}>
          <div className={styles.avatar}>
            {initials(member.first_name, member.last_name)}
          </div>
          <div className={styles.nameBlock}>
            <span className={styles.fullName}>
              {member.first_name} {member.last_name}
            </span>
            {member.zekken_text && (
              <span className={styles.zekken}>{member.zekken_text}</span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className={styles.infoCard}>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Rank</span>
              <span className={styles.infoValue}>
                {formatRank(member.rank_number, member.rank_type)}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Status</span>
              <span
                className={styles.statusBadge}
                style={{ background: statusStyle.bg, color: statusStyle.color }}
              >
                {member.status ?? '—'}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Member ID</span>
              <span className={styles.infoValue}>#{member.member_id}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Email</span>
              <span className={styles.infoValue}>{member.email ?? '—'}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Birthday</span>
              <span className={styles.infoValue}>{formatBirthday(member.birthday)}</span>
            </div>
          </div>
        </div>

        {/* Event activity */}
        {eventCounts && (
          <div className={styles.eventsCard}>
            <div className={styles.eventsHeader}>
              <span className={styles.eventsTitle}>Event Activity — {thisYear}</span>
              <span className={styles.eventsTotal}>{total} event{total !== 1 ? 's' : ''}</span>
            </div>
            <div className={styles.breakdownGrid}>
              {[
                { key: 'tournament', label: 'Tournament', count: eventCounts.tournaments },
                { key: 'seminar',    label: 'Seminar',    count: eventCounts.seminars   },
                { key: 'shinsa',     label: 'Shinsa',     count: eventCounts.shinsa     },
              ].map(({ key, label, count }) => (
                <div key={key} className={styles.breakdownItem}>
                  <div className={styles.breakdownCount}>{count}</div>
                  <div
                    className={styles.breakdownLabel}
                    style={{ color: BREAKDOWN_COLORS[key] }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
