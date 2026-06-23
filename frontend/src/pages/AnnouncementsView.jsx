import { useState, useEffect } from 'react';
import { isOffHours } from '../js/offHours';
import OffHoursCard from '../react_components/OffHoursCard';

const BASE_URL = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';

const COLORS = {
  page:        '#1a1a2e',
  card:        '#2a2a3e',
  cardInner:   '#1e1e32',
  border:      '#3a3a52',
  borderLight: '#444',
  text:        '#fff',
  textMuted:   '#bbb',
  textFaint:   '#888',
  textLabel:   '#aaa',
};

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function parseAttachments(pdfUrl) {
  if (!pdfUrl) return [];
  if (pdfUrl.startsWith('[')) {
    try { return JSON.parse(pdfUrl); } catch { /* fall through */ }
  }
  return [pdfUrl];
}

function attachmentType(url) {
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'other';
}

function attachmentLabel(url) {
  try {
    const segment = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    const dashIdx = segment.indexOf('-');
    return dashIdx >= 0 ? segment.slice(dashIdx + 1) : segment;
  } catch {
    return 'attachment';
  }
}

function groupByMonth(announcements) {
  const sorted = [...announcements].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const groups = new Map();
  sorted.forEach(a => {
    const d = new Date(a.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!groups.has(key)) groups.set(key, { key, label, items: [] });
    groups.get(key).items.push(a);
  });
  return [...groups.values()];
}

function AnnouncementCard({ a }) {
  const [expanded, setExpanded] = useState(false);
  const [openPdfs, setOpenPdfs] = useState(new Set());

  const attachments = parseAttachments(a.pdf_url);
  const images = attachments.filter(u => attachmentType(u) === 'image');
  const pdfs   = attachments.filter(u => attachmentType(u) === 'pdf');
  const others = attachments.filter(u => attachmentType(u) === 'other');

  function togglePdf(i) {
    setOpenPdfs(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div style={{ background: COLORS.card, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '1.1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: COLORS.text, lineHeight: 1.3 }}>{a.subject}</span>
          <span style={{ fontSize: '0.75rem', color: COLORS.textLabel, whiteSpace: 'nowrap', marginLeft: 8 }}>
            {formatDate(a.created_at)}
          </span>
        </div>

        <p style={{
          fontSize: '0.875rem',
          color: COLORS.textMuted,
          whiteSpace: 'pre-wrap',
          margin: '0 0 0.5rem 0',
          display: '-webkit-box',
          WebkitLineClamp: expanded ? 'unset' : 4,
          WebkitBoxOrient: 'vertical',
          overflow: expanded ? 'visible' : 'hidden',
        }}>
          {a.body}
        </p>

        {images.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '0.5rem' }}>
            {images.map((url, i) => (
              <img key={i} src={url} alt={attachmentLabel(url)}
                style={{ width: '100%', borderRadius: 6, display: 'block' }} />
            ))}
          </div>
        )}

        {others.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: '0.5rem' }}>
            {others.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer"
                style={{ fontSize: '0.85rem', color: '#6ea8fe' }}>
                📎 {attachmentLabel(url)}
              </a>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: '0.25rem' }}>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ background: 'none', border: 'none', color: COLORS.textLabel, cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
          {pdfs.map((_, i) => (
            <button
              key={i}
              onClick={() => togglePdf(i)}
              style={{
                background: 'transparent',
                border: `1px solid ${COLORS.borderLight}`,
                color: '#ccc',
                borderRadius: 6,
                padding: '0.2rem 0.65rem',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              {openPdfs.has(i) ? 'Hide Newsletter' : 'View Newsletter'}
            </button>
          ))}
        </div>
      </div>

      {pdfs.map((url, i) =>
        openPdfs.has(i) ? (
          <div key={i} style={{ borderTop: `1px solid ${COLORS.border}` }}>
            <iframe src={url} title={attachmentLabel(url)} width="100%" height="520px"
              style={{ display: 'block' }} />
            <div style={{ padding: '6px 12px 10px' }}>
              <a href={url} target="_blank" rel="noreferrer"
                style={{ fontSize: '0.8rem', color: COLORS.textFaint }}>
                Open / Download ↗
              </a>
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}

function MonthGroup({ label, items, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.25rem',
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: open ? '10px 10px 0 0' : '10px',
          cursor: 'pointer',
          color: COLORS.text,
          fontWeight: 600,
          fontSize: '0.95rem',
        }}
      >
        <span>{label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: COLORS.textLabel, fontWeight: 400, fontSize: '0.85rem' }}>
            {items.length} announcement{items.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: '0.7rem', color: COLORS.textLabel }}>{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div style={{
          background: COLORS.cardInner,
          border: `1px solid ${COLORS.border}`,
          borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          padding: '1rem',
        }}>
          <div className="row g-3">
            {items.map(a => (
              <div key={a.announcement_id} className="col-12 col-md-6 col-xl-4">
                <AnnouncementCard a={a} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnnouncementsView() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOffHours()) { setLoading(false); return; }
    fetch(`${BASE_URL}/announcements`)
      .then(r => r.json())
      .then(d => setAnnouncements(d.announcements ?? []))
      .catch(() => setError('Failed to load announcements.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ background: COLORS.page, minHeight: '100vh', padding: '2%' }}>
      <p style={{ color: COLORS.textFaint }}>Loading announcements...</p>
    </div>
  );
  if (isOffHours()) return <OffHoursCard />;
  if (error) return (
    <div style={{ background: COLORS.page, minHeight: '100vh', padding: '2%' }}>
      <p style={{ color: '#e05252' }}>{error}</p>
    </div>
  );
  if (announcements.length === 0) return (
    <div style={{ background: COLORS.page, minHeight: '100vh', padding: '2%' }}>
      <p style={{ color: COLORS.textFaint }}>No announcements yet.</p>
    </div>
  );

  const groups = groupByMonth(announcements);

  return (
    <div style={{ background: COLORS.page, minHeight: '100vh', padding: '2%', color: COLORS.text }}>
      <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '1.5rem' }}>Announcements</h2>
      {groups.map((g, i) => (
        <MonthGroup key={g.key} label={g.label} items={g.items} defaultOpen={i === 0} />
      ))}
    </div>
  );
}
