import { useState, useRef } from 'react';
import { userManager } from '../js/cognitoManager';
import { isOffHours, OFF_HOURS_MSG } from '../js/offHours';

const BASE_URL       = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';
const UPLOAD_URL_API = `${BASE_URL}/announcements/upload-url`;
const SEND_API       = `${BASE_URL}/announcements/send`;

const inputStyle = {
  background: '#1a1a2e',
  border: '1px solid #444',
  borderRadius: 6,
  color: '#fff',
  padding: '0.4rem 0.75rem',
  fontSize: '0.875rem',
  width: '100%',
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

export default function Announcements() {
  const [subject, setSubject]         = useState('');
  const [body, setBody]               = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading]     = useState(false);
  const [sending, setSending]         = useState(false);
  const [result, setResult]           = useState(null);
  const [error, setError]             = useState('');
  const fileInputRef                  = useRef(null);

  async function getToken() {
    const user = await userManager.getUser();
    return user?.id_token ?? null;
  }

  async function handleFileChange(e) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setUploading(true);
    setError('');

    const token = await getToken();
    const uploaded = [];

    for (const file of files) {
      try {
        const res = await fetch(
          `${UPLOAD_URL_API}?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type || 'application/octet-stream')}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get upload URL');

        await fetch(data.upload_url, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });

        uploaded.push({ name: file.name, url: data.pdf_url });
      } catch (err) {
        setError(`Upload failed for "${file.name}": ${err.message}`);
      }
    }

    setAttachments(prev => [...prev, ...uploaded]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleRemove(index) {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSend(target = 'all') {
    if (isOffHours()) { setError(OFF_HOURS_MSG); return; }
    if (!subject.trim() || !body.trim()) {
      setError('Subject and message are required.');
      return;
    }

    setSending(true);
    setError('');
    setResult(null);

    try {
      const token = await getToken();
      const res = await fetch(SEND_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject,
          body,
          attachment_urls: attachments.map(a => a.url),
          target,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setResult(data);
      setSubject('');
      setBody('');
      setAttachments([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err.message);
    }
    setSending(false);
  }

  return (
    <div style={{ background: '#1a1a2e', minHeight: '100vh', padding: '2%', color: '#fff' }}>
      <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.3rem 0' }}>Send Announcement</h2>
      <p style={{ color: '#aaa', fontSize: '0.875rem', marginBottom: '1.75rem' }}>
        Sends an email to all members. Attach files if needed.
      </p>

      <form onSubmit={e => e.preventDefault()} style={{ maxWidth: 560 }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Subject</label>
          <input
            type="text"
            style={inputStyle}
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="e.g. June Newsletter"
            disabled={sending}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Message</label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: 140, fontFamily: 'inherit' }}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your announcement here..."
            disabled={sending}
          />
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={labelStyle}>
            Attachments <span style={{ color: '#666', fontWeight: 400 }}>(optional)</span>
          </label>

          <div style={{ marginBottom: '0.6rem' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || sending}
              style={{
                background: 'transparent',
                border: '1px solid #555',
                color: '#ccc',
                borderRadius: 6,
                padding: '0.3rem 0.85rem',
                cursor: uploading || sending ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
              }}
            >
              {uploading ? 'Uploading...' : '+ Add attachment'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {attachments.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: '0.875rem' }}>
              {attachments.map((a, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: '#75b798' }}>📎 {a.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(i)}
                    disabled={sending}
                    style={{ background: 'none', border: 'none', color: '#e05252', cursor: 'pointer', padding: '0 4px', fontSize: '1rem', lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <div style={{ background: '#2a0e0e', border: '1px solid #6b2020', color: '#f5a8a8', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ background: '#0e2a1a', border: '1px solid #1a5c35', color: '#75b798', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {result.message}
            {result.failed > 0 && (
              <div style={{ marginTop: 4, color: '#888', fontSize: '0.8rem' }}>
                Failed addresses: {result.failures.join(', ')}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={sending || uploading || !subject.trim() || !body.trim()}
            onClick={() => handleSend('all')}
            style={{
              background: sending || uploading || !subject.trim() || !body.trim() ? '#333' : '#fff',
              color: sending || uploading || !subject.trim() || !body.trim() ? '#666' : '#1a1a2e',
              border: 'none',
              borderRadius: 6,
              padding: '0.5rem 1.25rem',
              fontWeight: 600,
              cursor: sending || uploading || !subject.trim() || !body.trim() ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
            }}
          >
            {sending ? 'Sending...' : 'Send to All Members'}
          </button>
          <button
            type="button"
            disabled={sending || uploading || !subject.trim() || !body.trim()}
            onClick={() => handleSend('senseis')}
            style={{
              background: sending || uploading || !subject.trim() || !body.trim() ? '#333' : '#2a1f00',
              color: sending || uploading || !subject.trim() || !body.trim() ? '#666' : '#ffc107',
              border: sending || uploading || !subject.trim() || !body.trim() ? 'none' : '1px solid #ffc10755',
              borderRadius: 6,
              padding: '0.5rem 1.25rem',
              fontWeight: 600,
              cursor: sending || uploading || !subject.trim() || !body.trim() ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
            }}
          >
            {sending ? 'Sending...' : 'Send to Senseis Only'}
          </button>
        </div>
      </form>
    </div>
  );
}
