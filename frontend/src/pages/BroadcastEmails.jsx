import { useState, useEffect } from 'react';
import { userManager } from '../js/cognitoManager';

const BASE_URL = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';
const EXTRA_EMAILS_API = `${BASE_URL}/announcements/extraEmails`;

const inputStyle = {
  background: '#1a1a2e',
  border: '1px solid #444',
  borderRadius: 6,
  color: '#fff',
  padding: '0.4rem 0.75rem',
  fontSize: '0.875rem',
  boxSizing: 'border-box',
  outline: 'none',
};

const labelStyle = {
  display: 'block',
  color: '#aaa',
  fontSize: '0.8rem',
  marginBottom: '0.35rem',
  fontWeight: 600,
};

export default function BroadcastEmails() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [removingEmail, setRemovingEmail] = useState(null);
  const [error, setError] = useState('');

  async function getAuthHeader() {
    const user = await userManager.getUser();
    return { Authorization: `Bearer ${user?.id_token ?? ''}` };
  }

  async function loadEmails() {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(EXTRA_EMAILS_API, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load emails');
      setEmails(data.data ?? []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  useEffect(() => { loadEmails(); }, []);

  async function handleAdd() {
    if (!email.trim()) {
      setError('Please enter an email address.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const headers = await getAuthHeader();
      const res = await fetch(EXTRA_EMAILS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ email: email.trim(), label: label.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add email');
      setEmail('');
      setLabel('');
      await loadEmails();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  async function handleRemove(targetEmail) {
    setRemovingEmail(targetEmail);
    setError('');
    try {
      const headers = await getAuthHeader();
      const res = await fetch(EXTRA_EMAILS_API, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove email');
      setEmails(prev => prev.filter(e => e.email !== targetEmail));
    } catch (err) {
      setError(err.message);
    }
    setRemovingEmail(null);
  }

  return (
    <div style={{ background: '#1a1a2e', minHeight: '100vh', padding: '2%', color: '#fff' }}>
      <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.3rem 0' }}>Broadcast Recipients</h2>
      <p style={{ color: '#aaa', fontSize: '0.875rem', marginBottom: '1.75rem' }}>
        Extra email addresses (e.g. parents without their own member account) that get included whenever an announcement is sent to "All Active Members".
      </p>

      <div style={{ maxWidth: 560, display: 'flex', gap: '0.6rem', alignItems: 'flex-end', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px' }}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            style={{ ...inputStyle, width: '100%' }}
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="parent@example.com"
            disabled={saving}
          />
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <label style={labelStyle}>Note (optional)</label>
          <input
            type="text"
            style={{ ...inputStyle, width: '100%' }}
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Jane's parent"
            disabled={saving}
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={saving}
          style={{
            background: '#28a745',
            border: 'none',
            color: '#fff',
            borderRadius: 6,
            padding: '0.45rem 1.1rem',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {saving ? 'Adding...' : '+ Add'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#2a0e0e', border: '1px solid #6b2020', color: '#f5a8a8', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.875rem', marginBottom: '1rem', maxWidth: 560 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#aaa', fontSize: '0.875rem' }}>Loading...</p>
      ) : emails.length === 0 ? (
        <p style={{ color: '#aaa', fontSize: '0.875rem' }}>No extra recipients added yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxWidth: 560 }}>
          {emails.map(e => (
            <li key={e.email} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#20203a', border: '1px solid #333', borderRadius: 6,
              padding: '0.5rem 0.85rem', marginBottom: '0.5rem', fontSize: '0.875rem',
            }}>
              <span>
                {e.email}
                {e.label && <span style={{ color: '#888' }}> — {e.label}</span>}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(e.email)}
                disabled={removingEmail === e.email}
                style={{ background: 'none', border: 'none', color: '#e05252', cursor: 'pointer', padding: '0 4px', fontSize: '1rem', lineHeight: 1 }}
              >
                {removingEmail === e.email ? '...' : '✕'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
