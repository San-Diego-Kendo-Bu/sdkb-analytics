import { useState, useEffect } from 'react';
import { userManager } from '../js/cognitoManager';

const BASE_URL = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';
const EVENTS_API = `${BASE_URL}/events`;
const EVENT_CONFIG_API = `${BASE_URL}/events/configure`;
const RESULTS_API = `${BASE_URL}/events/tournamentResults`;
const MEMBERS_API = `${BASE_URL}/members`;

const PLACEMENT_PRESETS = ['First', 'Second', 'Third', 'Kantosho'];

const S = {
  page: { padding: '2%', background: '#1a1a2e', minHeight: '100vh', color: '#fff' },
  title: { fontSize: '1.6rem', fontWeight: 700, margin: '0 0 1.5rem 0' },
  tabRow: { display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' },
  tab: (active) => ({
    padding: '0.45rem 1.2rem',
    borderRadius: '6px',
    border: active ? 'none' : '1px solid #444',
    background: active ? '#fff' : 'transparent',
    color: active ? '#1a1a2e' : '#aaa',
    cursor: 'pointer',
    fontWeight: active ? 700 : 400,
    fontSize: '0.9rem',
  }),
  label: { display: 'block', color: '#aaa', fontSize: '0.8rem', marginBottom: '0.35rem' },
  select: {
    background: '#2a2a3e', border: '1px solid #444', borderRadius: '6px',
    color: '#fff', padding: '0.5rem 0.75rem', fontSize: '0.9rem', width: '100%',
  },
  input: {
    background: '#2a2a3e', border: '1px solid #444', borderRadius: '6px',
    color: '#fff', padding: '0.5rem 0.75rem', fontSize: '0.9rem', width: '100%',
  },
  card: {
    background: '#0d0d1a', border: '1px solid #333', borderRadius: '10px',
    padding: '1.25rem', marginBottom: '1rem',
  },
  sectionTitle: { fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: '#ddd' },
  row: { display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '0.75rem' },
  field: { flex: 1, minWidth: '140px' },
  addBtn: {
    background: '#fff', color: '#1a1a2e', border: 'none', borderRadius: '6px',
    padding: '0.5rem 1.1rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
    whiteSpace: 'nowrap',
  },
  saveBtn: {
    background: '#198754', color: '#fff', border: 'none', borderRadius: '6px',
    padding: '0.55rem 1.4rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem',
    marginTop: '1rem',
  },
  deleteBtn: {
    background: 'transparent', color: '#dc3545', border: '1px solid #dc3545',
    borderRadius: '5px', padding: '0.2rem 0.55rem', cursor: 'pointer', fontSize: '0.8rem',
  },
  resultRow: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '0.5rem 0.75rem', borderRadius: '6px', background: '#1a1a2e',
    marginBottom: '0.4rem',
  },
  badge: (color) => ({
    background: color + '22', color, border: `1px solid ${color}55`,
    borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.78rem', fontWeight: 600,
  }),
  emptyText: { color: '#666', fontStyle: 'italic', fontSize: '0.9rem' },
  divGroup: { marginBottom: '1.25rem' },
  divLabel: { color: '#6ea8fe', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' },
  historyCard: {
    background: '#0d0d1a', border: '1px solid #333', borderRadius: '10px',
    marginBottom: '0.75rem', overflow: 'hidden',
  },
  historyHeader: {
    padding: '0.85rem 1.1rem', display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', cursor: 'pointer',
  },
  historyBody: { padding: '0.75rem 1.1rem 1rem', borderTop: '1px solid #222' },
  memberList: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' },
  memberCheckbox: {
    display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.6rem',
    background: '#1a1a2e', borderRadius: '5px', border: '1px solid #333',
    cursor: 'pointer', fontSize: '0.85rem',
  },
};

const PLACEMENT_COLORS = {
  First: '#ffd700',
  Second: '#c0c0c0',
  Third: '#cd7f32',
  Kantosho: '#75b798',
};

function placementColor(p) {
  return PLACEMENT_COLORS[p] ?? '#aaa';
}

export default function TournamentResults() {
  const [tab, setTab] = useState('record');
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [evRes, memRes] = await Promise.all([fetch(EVENTS_API), fetch(MEMBERS_API)]);
      const [evData, memData] = await Promise.all([evRes.json(), memRes.json()]);
      const allEvents = (evData.body ?? []).filter(e => e.event_type === 'tournament');
      const allMembers = (memData.items ?? []).sort((a, b) =>
        `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`)
      );
      setEvents(allEvents);
      setMembers(allMembers);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div style={S.page}><p>Loading...</p></div>;

  const pastEvents = events.filter(e => e.event_date && new Date(e.event_date) <= new Date());

  return (
    <div style={S.page}>
      <h2 style={S.title}>Tournament Results</h2>
      <div style={S.tabRow}>
        <button style={S.tab(tab === 'record')} onClick={() => setTab('record')}>Record</button>
        <button style={S.tab(tab === 'history')} onClick={() => setTab('history')}>History</button>
      </div>

      {tab === 'record'
        ? <RecordTab pastEvents={pastEvents} members={members} />
        : <HistoryTab historyEvents={pastEvents} />
      }
    </div>
  );
}

function RecordTab({ pastEvents, members }) {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [divisions, setDivisions] = useState([]);
  const [existingResults, setExistingResults] = useState([]);
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  function emptyDraft() {
    return { division: '', customDivision: '', placement: '', customPlacement: '', selectedMemberIds: [], isTeams: false };
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function loadTournamentData(eventId) {
    const [cfgRes, resRes] = await Promise.all([
      fetch(`${EVENT_CONFIG_API}?event_id=${eventId}`),
      fetch(`${RESULTS_API}?event_id=${eventId}`),
    ]);
    const [cfgData, resData] = await Promise.all([cfgRes.json(), resRes.json()]);
    setDivisions(cfgData.data?.divisions ?? []);
    setExistingResults(resData.data ?? []);
  }

  function handleEventChange(e) {
    const id = e.target.value;
    setSelectedEventId(id);
    setDraft(emptyDraft());
    setExistingResults([]);
    setDivisions([]);
    if (id) loadTournamentData(id);
  }

  function toggleMember(memberId) {
    setDraft(d => {
      const ids = d.selectedMemberIds.includes(memberId)
        ? d.selectedMemberIds.filter(id => id !== memberId)
        : [...d.selectedMemberIds, memberId];
      return { ...d, selectedMemberIds: ids, isTeams: ids.length > 1 };
    });
  }

  function addResult() {
    const division = draft.division === '__custom__' ? draft.customDivision.trim() : draft.division;
    const placement = draft.placement === '__custom__' ? draft.customPlacement.trim() : draft.placement;

    if (!division || !placement || draft.selectedMemberIds.length === 0) {
      showToast('Please fill in division, placement, and at least one member.');
      return;
    }

    const newRows = draft.selectedMemberIds.map(mid => {
      const member = members.find(m => String(m.member_id) === String(mid));
      return {
        _key: `${Date.now()}_${mid}`,
        event_id: selectedEventId,
        member_id: mid,
        member_name: member ? `${member.first_name} ${member.last_name}` : String(mid),
        division,
        placement,
        is_teams: draft.isTeams,
        _unsaved: true,
      };
    });

    setExistingResults(r => [...r, ...newRows]);
    setDraft(emptyDraft());
  }

  async function deleteResult(result) {
    if (result._unsaved) {
      setExistingResults(r => r.filter(x => x._key !== result._key));
      return;
    }
    const user = await userManager.getUser();
    const res = await fetch(`${RESULTS_API}?result_id=${result.result_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${user.id_token}` },
    });
    if (res.ok) {
      setExistingResults(r => r.filter(x => x.result_id !== result.result_id));
    } else {
      showToast('Failed to delete result.');
    }
  }

  async function saveResults() {
    const unsaved = existingResults.filter(r => r._unsaved);
    if (!unsaved.length) { showToast('No new results to save.'); return; }
    setSaving(true);
    const user = await userManager.getUser();
    const res = await fetch(RESULTS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.id_token}` },
      body: JSON.stringify({
        event_id: parseInt(selectedEventId),
        results: unsaved.map(r => ({
          member_id: r.member_id,
          member_name: r.member_name,
          division: r.division,
          placement: r.placement,
          is_teams: r.is_teams,
        })),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Results saved!');
      await loadTournamentData(selectedEventId);
    } else {
      showToast(data.error ?? 'Failed to save results.');
    }
    setSaving(false);
  }

  if (pastEvents.length === 0) {
    return (
      <div style={S.card}>
        <p style={S.emptyText}>No past tournaments found.</p>
      </div>
    );
  }

  const unsavedCount = existingResults.filter(r => r._unsaved).length;

  return (
    <>
      <div style={S.card}>
        <label style={S.label}>Tournament</label>
        <select style={S.select} value={selectedEventId} onChange={handleEventChange}>
          <option value="">— Select a tournament —</option>
          {pastEvents.map(e => (
            <option key={e.event_id} value={e.event_id}>
              {e.event_name} ({new Date(e.event_date).toLocaleDateString('en-US', { timeZone: 'UTC' })})
            </option>
          ))}
        </select>
      </div>

      {selectedEventId && (
        <>
          <div style={S.card}>
            <div style={S.sectionTitle}>Recorded Results</div>
            {existingResults.length === 0
              ? <p style={S.emptyText}>No results recorded yet.</p>
              : groupByDivision(existingResults).map(([div, rows]) => (
                  <div key={div} style={S.divGroup}>
                    <div style={S.divLabel}>{div}</div>
                    {rows.map(r => (
                      <div key={r.result_id ?? r._key} style={S.resultRow}>
                        <span style={S.badge(placementColor(r.placement))}>{r.placement}</span>
                        <span style={{ flex: 1, fontSize: '0.9rem' }}>{r.member_name}</span>
                        {r.is_teams && <span style={{ color: '#aaa', fontSize: '0.78rem' }}>Team</span>}
                        {r._unsaved && <span style={{ color: '#fd9843', fontSize: '0.75rem' }}>unsaved</span>}
                        <button style={S.deleteBtn} onClick={() => deleteResult(r)}>✕</button>
                      </div>
                    ))}
                  </div>
                ))
            }
          </div>

          <div style={S.card}>
            <div style={S.sectionTitle}>Add Result</div>

            <div style={S.row}>
              <div style={S.field}>
                <label style={S.label}>Division</label>
                <select style={S.select} value={draft.division}
                  onChange={e => setDraft(d => ({ ...d, division: e.target.value }))}>
                  <option value="">— Select —</option>
                  {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                  <option value="__custom__">Custom...</option>
                </select>
              </div>
              {draft.division === '__custom__' && (
                <div style={S.field}>
                  <label style={S.label}>Division name</label>
                  <input style={S.input} value={draft.customDivision}
                    onChange={e => setDraft(d => ({ ...d, customDivision: e.target.value }))}
                    placeholder="e.g. Men's Shodan" />
                </div>
              )}
              <div style={S.field}>
                <label style={S.label}>Placement</label>
                <select style={S.select} value={draft.placement}
                  onChange={e => setDraft(d => ({ ...d, placement: e.target.value }))}>
                  <option value="">— Select —</option>
                  {PLACEMENT_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
                  <option value="__custom__">Custom...</option>
                </select>
              </div>
              {draft.placement === '__custom__' && (
                <div style={S.field}>
                  <label style={S.label}>Placement name</label>
                  <input style={S.input} value={draft.customPlacement}
                    onChange={e => setDraft(d => ({ ...d, customPlacement: e.target.value }))}
                    placeholder="e.g. Fighting Spirit" />
                </div>
              )}
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={S.label}>
                Member(s) — select multiple for team events
              </label>
              <div style={S.memberList}>
                {members.map(m => {
                  const sid = String(m.member_id);
                  const checked = draft.selectedMemberIds.includes(sid);
                  return (
                    <label key={sid} style={{ ...S.memberCheckbox, borderColor: checked ? '#6ea8fe' : '#333' }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleMember(sid)}
                        style={{ accentColor: '#6ea8fe' }} />
                      {m.first_name} {m.last_name}
                    </label>
                  );
                })}
              </div>
              {draft.isTeams && (
                <p style={{ color: '#fd9843', fontSize: '0.8rem', margin: '0.4rem 0 0' }}>
                  Team event — {draft.selectedMemberIds.length} members selected
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button style={S.addBtn} onClick={addResult}>+ Add</button>
              {unsavedCount > 0 && (
                <button style={S.saveBtn} onClick={saveResults} disabled={saving}>
                  {saving ? 'Saving...' : `Save ${unsavedCount} result${unsavedCount !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          background: '#333', color: '#fff', borderRadius: '8px', padding: '0.7rem 1.4rem',
          fontSize: '0.9rem', zIndex: 999,
        }}>{toast}</div>
      )}
    </>
  );
}

function HistoryTab({ historyEvents }) {
  const [expanded, setExpanded] = useState({});
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});

  async function toggleEvent(eventId) {
    const id = String(eventId);
    setExpanded(e => ({ ...e, [id]: !e[id] }));
    if (!results[id] && !loading[id]) {
      setLoading(l => ({ ...l, [id]: true }));
      const res = await fetch(`${RESULTS_API}?event_id=${eventId}`);
      const data = await res.json();
      setResults(r => ({ ...r, [id]: data.data ?? [] }));
      setLoading(l => ({ ...l, [id]: false }));
    }
  }

  if (historyEvents.length === 0) {
    return (
      <div style={S.card}>
        <p style={S.emptyText}>No past tournament results.</p>
      </div>
    );
  }

  return (
    <>
      {historyEvents
        .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))
        .map(e => {
          const id = String(e.event_id);
          const isOpen = !!expanded[id];
          const rows = results[id] ?? [];
          return (
            <div key={id} style={S.historyCard}>
              <div style={S.historyHeader} onClick={() => toggleEvent(e.event_id)}>
                <span style={{ fontWeight: 600 }}>{e.event_name}</span>
                <span style={{ color: '#aaa', fontSize: '0.85rem' }}>
                  {new Date(e.event_date).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                  {' '}{isOpen ? '▲' : '▼'}
                </span>
              </div>
              {isOpen && (
                <div style={S.historyBody}>
                  {loading[id] && <p style={S.emptyText}>Loading...</p>}
                  {!loading[id] && rows.length === 0 && <p style={S.emptyText}>No results recorded.</p>}
                  {!loading[id] && rows.length > 0 &&
                    groupByDivision(rows).map(([div, divRows]) => (
                      <div key={div} style={S.divGroup}>
                        <div style={S.divLabel}>{div}</div>
                        {divRows.map(r => (
                          <div key={r.result_id} style={S.resultRow}>
                            <span style={S.badge(placementColor(r.placement))}>{r.placement}</span>
                            <span style={{ flex: 1, fontSize: '0.9rem' }}>{r.member_name}</span>
                            {r.is_teams && <span style={{ color: '#aaa', fontSize: '0.78rem' }}>Team</span>}
                          </div>
                        ))}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          );
        })}
    </>
  );
}

function groupByDivision(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.division;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return Array.from(map.entries());
}
