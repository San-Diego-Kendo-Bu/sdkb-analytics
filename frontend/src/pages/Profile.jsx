import { useState, useEffect } from 'react';
import { userManager } from '../js/cognitoManager';
import styles from '../../css/profile.module.css';

const BASE_URL = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';
const MEMBERS_API      = `${BASE_URL}/members`;
const EVENTS_API       = `${BASE_URL}/events`;
const TOURNAMENT_API   = `${BASE_URL}/events/tournamentRegistrations`;
const SHINSA_API       = `${BASE_URL}/events/shinsaRegistrations`;
const SEMINAR_API      = `${BASE_URL}/events/seminarRegistrations`;
const RESULTS_API      = `${BASE_URL}/events/tournamentResults`;

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

const PLACEMENT_COLORS = {
  First:    '#ffd700',
  Second:   '#c0c0c0',
  Third:    '#cd7f32',
  Kantosho: '#75b798',
};

function placementColor(p) {
  return PLACEMENT_COLORS[p] ?? '#aaa';
}

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

const MEMBERS_SELF_API = `${BASE_URL}/members/self`;

export default function Profile() {
  const [member, setMember] = useState(null);
  const [eventCounts, setEventCounts] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [hoveredBreakdown, setHoveredBreakdown] = useState(null);
  const [editingBirthday, setEditingBirthday] = useState(false);
  const [birthdayInput, setBirthdayInput] = useState('');
  const [savingBirthday, setSavingBirthday] = useState(false);
  const [birthdayError, setBirthdayError] = useState('');

  useEffect(() => {
    async function load() {
      const user = await userManager.getUser();
      if (!user || user.expired) { setLoading(false); return; }

      const username = user.profile?.preferred_username;
      if (!username) { setLoading(false); return; }

      const usernameRes = await fetch(`${MEMBERS_API}?username=${encodeURIComponent(username)}`);
      const usernameData = await usernameRes.json();
      const memberId = usernameData.items?.[0]?.member_id;

      if (!memberId) { setLoading(false); return; }

      const [memberRes, eventsRes, tourneyRes, shinsaRes, seminarRes, resultsRes] = await Promise.all([
        fetch(`${MEMBERS_API}?member_id=${memberId}`),
        fetch(EVENTS_API),
        fetch(TOURNAMENT_API),
        fetch(SHINSA_API),
        fetch(SEMINAR_API),
        fetch(`${RESULTS_API}?member_id=${memberId}`),
      ]);

      const [memberData, eventsData, tourneyData, shinsaData, seminarData, resultsData] = await Promise.all([
        memberRes.json(),
        eventsRes.json(),
        tourneyRes.json(),
        shinsaRes.json(),
        seminarRes.json(),
        resultsRes.json(),
      ]);

      const me = memberData.items?.[0] ?? null;
      setMember(me);

      if (me) {
        const mid = Number(me.member_id);

        const eventMap = Object.fromEntries(
          (eventsData.body ?? []).map(e => [String(e.event_id), e])
        );

        const toEventList = (rows) =>
          rows
            .filter(r => Number(r.member_id) === mid)
            .map(r => {
              const ev = eventMap[String(r.event_id)];
              return { name: ev?.event_name ?? `Event #${r.event_id}`, date: ev?.event_date };
            })
            .filter(item => item.date)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const tournamentList = toEventList(tourneyData.body ?? []);
        const shinsaList     = toEventList(shinsaData.body ?? []);
        const seminarList    = toEventList(seminarData.body ?? []);

        setEventCounts({
          tournaments: tournamentList.length,
          shinsa:      shinsaList.length,
          seminars:    seminarList.length,
          tournamentList,
          shinsaList,
          seminarList,
        });
        setAchievements(resultsData.data ?? []);
      }

      setLoading(false);
    }

    load();
  }, []);

  async function saveBirthday() {
    if (!birthdayInput) { setBirthdayError('Please enter a date.'); return; }
    setSavingBirthday(true);
    setBirthdayError('');
    try {
      const user = await userManager.getUser();
      const res = await fetch(MEMBERS_SELF_API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.id_token}` },
        body: JSON.stringify({ birthday: birthdayInput }),
      });
      if (res.ok) {
        setMember(m => ({ ...m, birthday: birthdayInput }));
        setEditingBirthday(false);
      } else {
        const data = await res.json();
        setBirthdayError(data.message ?? 'Save failed.');
      }
    } catch {
      setBirthdayError('Network error.');
    }
    setSavingBirthday(false);
  }

  if (loading) {
    return <div className={styles.page}><p className={styles.loading}>Loading profile...</p></div>;
  }

  if (!member) {
    return <div className={styles.page}><p className={styles.loading}>Profile not found.</p></div>;
  }

  const statusStyle = STATUS_COLORS[member.status] ?? STATUS_COLORS.inactive;

  const filterByYear = (list) => selectedYear === 'All'
    ? list
    : list.filter(ev => ev.date && new Date(ev.date).getFullYear() === selectedYear);

  const filteredTournaments = filterByYear(eventCounts?.tournamentList ?? []);
  const filteredSeminars    = filterByYear(eventCounts?.seminarList ?? []);
  const filteredShinsa      = filterByYear(eventCounts?.shinsaList ?? []);
  const total = filteredTournaments.length + filteredSeminars.length + filteredShinsa.length;

  const filteredAchievements = selectedYear === 'All'
    ? achievements
    : achievements.filter(r => r.event_date && new Date(r.event_date).getFullYear() === selectedYear);

  const allDates = [
    ...(eventCounts?.tournamentList ?? []),
    ...(eventCounts?.seminarList ?? []),
    ...(eventCounts?.shinsaList ?? []),
  ].map(e => e.date).concat(achievements.map(r => r.event_date)).filter(Boolean);
  const availableYears = [...new Set(allDates.map(d => new Date(d).getFullYear()))].sort((a, b) => b - a);

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
              {editingBirthday ? (
                <div className={styles.birthdayEdit}>
                  <input
                    type="date"
                    className={styles.birthdayInput}
                    value={birthdayInput}
                    onChange={e => setBirthdayInput(e.target.value)}
                  />
                  <div className={styles.birthdayActions}>
                    <button className={styles.saveSmallBtn} onClick={saveBirthday} disabled={savingBirthday}>
                      {savingBirthday ? '…' : 'Save'}
                    </button>
                    <button className={styles.cancelSmallBtn} onClick={() => { setEditingBirthday(false); setBirthdayError(''); }}>
                      Cancel
                    </button>
                  </div>
                  {birthdayError && <span className={styles.birthdayError}>{birthdayError}</span>}
                </div>
              ) : (
                <div className={styles.birthdayRow}>
                  <span className={styles.infoValue}>{formatBirthday(member.birthday)}</span>
                  <button
                    className={styles.editBtn}
                    onClick={() => { setBirthdayInput(member.birthday ? new Date(member.birthday).toISOString().slice(0, 10) : ''); setEditingBirthday(true); }}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Event activity */}
        {eventCounts && (
          <div className={styles.eventsCard}>
            <div className={styles.eventsHeader}>
              <span className={styles.eventsTitle}>
                Event Activity — {selectedYear === 'All' ? 'All Years' : selectedYear}
              </span>
              <span className={styles.eventsTotal}>{total} event{total !== 1 ? 's' : ''}</span>
            </div>
            {availableYears.length > 1 && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                {availableYears.map(y => (
                  <button
                    key={y}
                    onClick={() => setSelectedYear(y)}
                    style={{
                      padding: '0.2rem 0.75rem', borderRadius: 20, fontSize: '0.8rem', cursor: 'pointer',
                      border: selectedYear === y ? 'none' : '1px solid #444',
                      background: selectedYear === y ? '#fff' : 'transparent',
                      color: selectedYear === y ? '#1a1a2e' : '#ccc',
                      fontWeight: selectedYear === y ? 700 : 400,
                    }}
                  >{y}</button>
                ))}
                <button
                  onClick={() => setSelectedYear('All')}
                  style={{
                    padding: '0.2rem 0.75rem', borderRadius: 20, fontSize: '0.8rem', cursor: 'pointer',
                    border: selectedYear === 'All' ? 'none' : '1px solid #444',
                    background: selectedYear === 'All' ? '#fff' : 'transparent',
                    color: selectedYear === 'All' ? '#1a1a2e' : '#ccc',
                    fontWeight: selectedYear === 'All' ? 700 : 400,
                  }}
                >All</button>
              </div>
            )}
            <div className={styles.breakdownGrid}>
              {[
                { key: 'tournament', label: 'Tournament', count: filteredTournaments.length, events: filteredTournaments },
                { key: 'seminar',    label: 'Seminar',    count: filteredSeminars.length,    events: filteredSeminars   },
                { key: 'shinsa',     label: 'Shinsa',     count: filteredShinsa.length,      events: filteredShinsa    },
              ].map(({ key, label, count, events }) => (
                <div
                  key={key}
                  className={styles.breakdownItem}
                  onMouseEnter={() => count > 0 && setHoveredBreakdown(key)}
                  onMouseLeave={() => setHoveredBreakdown(null)}
                >
                  {hoveredBreakdown === key && (
                    <div className={styles.breakdownTooltip}>
                      {events.slice(0, 5).map((ev, i) => (
                        <div key={i} className={styles.tooltipRow}>
                          <span className={styles.tooltipName}>{ev.name}</span>
                          <span className={styles.tooltipDate}>
                            {new Date(ev.date).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      ))}
                      {events.length > 5 && (
                        <div className={styles.tooltipMore}>+{events.length - 5} more</div>
                      )}
                    </div>
                  )}
                  <div className={styles.breakdownCount}>{count}</div>
                  <div className={styles.breakdownLabel} style={{ color: BREAKDOWN_COLORS[key] }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements */}
        {achievements.length > 0 && (
          <div className={styles.eventsCard}>
            <div className={styles.eventsHeader}>
              <span className={styles.eventsTitle}>
                Tournament Achievements{selectedYear !== 'All' ? ` — ${selectedYear}` : ''}
              </span>
              <span className={styles.eventsTotal}>{filteredAchievements.length} placement{filteredAchievements.length !== 1 ? 's' : ''}</span>
            </div>
            <div className={styles.achievementsList}>
              {filteredAchievements.length === 0
                ? <p style={{ color: '#666', fontSize: '0.875rem', margin: 0 }}>No placements for {selectedYear}.</p>
                : filteredAchievements.map(r => (
                <div key={r.result_id} className={styles.achievementRow}>
                  <span
                    className={styles.placementBadge}
                    style={{
                      background: placementColor(r.placement) + '22',
                      color: placementColor(r.placement),
                      border: `1px solid ${placementColor(r.placement)}55`,
                    }}
                  >
                    {r.placement}
                  </span>
                  <div className={styles.achievementInfo}>
                    <span className={styles.achievementEvent}>{r.event_name}</span>
                    <span className={styles.achievementMeta}>
                      {r.division}
                      {r.is_teams ? ' · Team' : ''}
                      {' · '}
                      {new Date(r.event_date).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
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
