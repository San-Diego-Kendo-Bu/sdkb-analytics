import { useState, useEffect } from 'react';
import { isOffHours } from '../js/offHours';
import OffHoursCard from '../react_components/OffHoursCard';

const BASE_URL = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function AnnouncementCard({ a }) {
  const [expanded, setExpanded] = useState(false);
  const [showPdf, setShowPdf] = useState(false);

  return (
    <div className="card shadow-sm h-100" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-body d-flex flex-column" style={{ minHeight: 180 }}>
        <div className="d-flex justify-content-between align-items-start mb-2">
          <h6 className="card-title mb-0 fw-semibold" style={{ lineHeight: 1.3 }}>{a.subject}</h6>
          <span className="text-muted ms-2" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
            {formatDate(a.created_at)}
          </span>
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          <p
            className="card-text mb-0"
            style={{
              fontSize: '0.875rem',
              whiteSpace: 'pre-wrap',
              display: '-webkit-box',
              WebkitLineClamp: expanded ? 'unset' : 4,
              WebkitBoxOrient: 'vertical',
              overflow: expanded ? 'visible' : 'hidden',
            }}
          >
            {a.body}
          </p>
        </div>

        <div className="mt-3 d-flex gap-2 flex-wrap align-items-center">
          <button
            className="btn btn-link btn-sm p-0 text-decoration-none"
            style={{ fontSize: '0.8rem' }}
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
          {a.pdf_url && (
            <button
              className="btn btn-outline-primary btn-sm"
              style={{ fontSize: '0.8rem' }}
              onClick={() => setShowPdf(v => !v)}
            >
              {showPdf ? 'Hide PDF' : 'View Newsletter'}
            </button>
          )}
        </div>
      </div>

      {showPdf && a.pdf_url && (
        <div style={{ borderTop: '1px solid #dee2e6' }}>
          <iframe
            src={a.pdf_url}
            title="Newsletter PDF"
            width="100%"
            height="520px"
            style={{ display: 'block' }}
          />
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

  if (loading) return <p className="text-muted p-3">Loading announcements...</p>;
  if (isOffHours()) return <OffHoursCard />;
  if (error) return <p className="text-danger p-3">{error}</p>;
  if (announcements.length === 0) return <p className="text-muted p-3">No announcements yet.</p>;

  return (
    <div>
      <h4 className="mb-4">Announcements</h4>
      <div className="row g-3">
        {announcements.map(a => (
          <div key={a.announcement_id} className="col-12 col-md-6 col-xl-4">
            <AnnouncementCard a={a} />
          </div>
        ))}
      </div>
    </div>
  );
}
