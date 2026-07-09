import { useState, useEffect } from 'react';

const BASE_URL = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';
const EVENTS_API = `${BASE_URL}/events`;
const RESULTS_API = `${BASE_URL}/events/tournamentResults`;

const PLACEMENT_COLORS = { First: '#ffd700', Second: '#c0c0c0', Third: '#cd7f32', Kantosho: '#75b798' };
const pc = (p) => PLACEMENT_COLORS[p] ?? '#aaa';

const S = {
  page: { padding: '2%', background: '#1a1a2e', minHeight: '100vh', color: '#fff' },
  title: { fontSize: '1.6rem', fontWeight: 700, margin: '0 0 1.5rem 0' },
  yearCard: { marginBottom: '0.75rem', borderRadius: '10px', overflow: 'hidden', border: '1px solid #333' },
  yearHeader: (open) => ({
    padding: '0.85rem 1.1rem', display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', background: '#2a2a3e', cursor: 'pointer',
    borderBottom: open ? '1px solid #333' : 'none',
  }),
  yearBody: { padding: '0.75rem', background: '#1a1a2e' },
  eventCard: { background: '#0d0d1a', border: '1px solid #2a2a3e', borderRadius: '8px', marginBottom: '0.5rem', overflow: 'hidden' },
  eventHeader: { padding: '0.6rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' },
  eventBody: { padding: '0.75rem 1rem', borderTop: '1px solid #1a1a2e' },
  divLabel: { color: '#6ea8fe', fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' },
  resultRow: { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.3rem 0', borderBottom: '1px solid #111' },
  badge: (color) => ({ background: color + '22', color, border: `1px solid ${color}55`, borderRadius: 4, padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 }),
  emptyText: { color: '#666', fontStyle: 'italic', fontSize: '0.85rem', margin: 0 },
};

function groupByDivision(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.division)) map.set(r.division, []);
    map.get(r.division).push(r);
  }
  return Array.from(map.entries());
}

export default function ResultsSummary() {
  const [eventsByYear, setEventsByYear] = useState({});
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedYear, setExpandedYear] = useState(null);
  const [expandedEvent, setExpandedEvent] = useState({});
  const [yearResults, setYearResults] = useState({});
  const [yearLoading, setYearLoading] = useState({});

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(EVENTS_API);
        const data = await res.json();
        const past = (data.body ?? []).filter(
          e => e.event_type === 'tournament' && e.event_date && new Date(e.event_date) < new Date()
        );
        const grouped = {};
        for (const e of past) {
          const year = new Date(e.event_date).getFullYear();
          if (!grouped[year]) grouped[year] = [];
          grouped[year].push(e);
        }
        for (const y of Object.keys(grouped)) {
          grouped[y].sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
        }
        const sortedYears = Object.keys(grouped).map(Number).sort((a, b) => b - a);
        setEventsByYear(grouped);
        setYears(sortedYears);
        if (sortedYears.length > 0) {
          setExpandedYear(sortedYears[0]);
          doLoadYear(sortedYears[0], grouped[sortedYears[0]]);
        }
      } catch (err) {
        console.error('ResultsSummary load error:', err);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function doLoadYear(year, events) {
    setYearLoading(l => ({ ...l, [year]: true }));
    const settled = await Promise.allSettled(
      events.map(async (e) => {
        const res = await fetch(`${RESULTS_API}?event_id=${e.event_id}`);
        const data = await res.json();
        return { eventId: String(e.event_id), results: data.data ?? [] };
      })
    );
    const map = {};
    for (const r of settled) {
      if (r.status === 'fulfilled') map[r.value.eventId] = r.value.results;
    }
    setYearResults(r => ({ ...r, [year]: map }));
    setYearLoading(l => ({ ...l, [year]: false }));
  }

  function toggleYear(year) {
    if (expandedYear === year) { setExpandedYear(null); return; }
    setExpandedYear(year);
    if (!yearResults[year] && !yearLoading[year]) doLoadYear(year, eventsByYear[year]);
  }

  function toggleEvent(eid) {
    setExpandedEvent(e => ({ ...e, [eid]: !e[eid] }));
  }

  if (loading) return <div style={S.page}><p style={S.emptyText}>Loading...</p></div>;
  if (!years.length) return <div style={S.page}><p style={S.emptyText}>No tournament results recorded yet.</p></div>;

  return (
    <div style={S.page}>
      <h2 style={S.title}>All Tournament Results</h2>
      {years.map(year => {
        const isYearOpen = expandedYear === year;
        const events = eventsByYear[year] ?? [];
        const rMap = yearResults[year] ?? {};
        const totalEntries = Object.values(rMap).reduce((sum, arr) => sum + arr.length, 0);

        return (
          <div key={year} style={S.yearCard}>
            <div style={S.yearHeader(isYearOpen)} onClick={() => toggleYear(year)}>
              <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{year}</span>
              <span style={{ color: '#aaa', fontSize: '0.85rem' }}>
                {events.length} tournament{events.length !== 1 ? 's' : ''}
                {isYearOpen && totalEntries > 0 ? ` · ${totalEntries} entr${totalEntries !== 1 ? 'ies' : 'y'}` : ''}
                {' '}{isYearOpen ? '▲' : '▼'}
              </span>
            </div>

            {isYearOpen && (
              <div style={S.yearBody}>
                {yearLoading[year] && <p style={S.emptyText}>Loading results...</p>}
                {!yearLoading[year] && events.map(e => {
                  const eid = String(e.event_id);
                  const rows = rMap[eid] ?? [];
                  if (!rows.length) return null;
                  const isEventOpen = !!expandedEvent[eid];
                  return (
                    <div key={eid} style={S.eventCard}>
                      <div style={S.eventHeader} onClick={() => toggleEvent(eid)}>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{e.event_name}</span>
                        <span style={{ color: '#aaa', fontSize: '0.8rem' }}>
                          {new Date(e.event_date).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}
                          {' · '}{rows.length} entr{rows.length !== 1 ? 'ies' : 'y'}
                          {' '}{isEventOpen ? '▲' : '▼'}
                        </span>
                      </div>
                      {isEventOpen && (
                        <div style={S.eventBody}>
                          {groupByDivision(rows).map(([div, divRows]) => (
                            <div key={div} style={{ marginBottom: '0.75rem' }}>
                              <div style={S.divLabel}>{div}</div>
                              {divRows.map(r => (
                                <div key={r.result_id} style={S.resultRow}>
                                  <span style={S.badge(pc(r.placement))}>{r.placement}</span>
                                  <span style={{ flex: 1, fontSize: '0.875rem', color: '#e0e0e0' }}>{r.member_name}</span>
                                  {r.is_teams && <span style={{ color: '#aaa', fontSize: '0.75rem' }}>Team</span>}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {!yearLoading[year] && events.every(e => !(rMap[String(e.event_id)]?.length)) && (
                  <p style={S.emptyText}>No results recorded for {year} yet.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
