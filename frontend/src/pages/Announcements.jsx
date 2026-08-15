import { useState, useRef, useEffect } from 'react';
import { userManager } from '../js/cognitoManager';
import { isOffHours, OFF_HOURS_MSG } from '../js/offHours';

const BASE_URL       = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';
const UPLOAD_URL_API = `${BASE_URL}/announcements/upload-url`;
const SEND_API       = `${BASE_URL}/announcements/send`;
const MEMBERS_API    = `${BASE_URL}/members`;

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

  const [members, setMembers]                     = useState([]);
  const [showSpecificPicker, setShowSpecificPicker] = useState(false);
  const [selectedIds, setSelectedIds]              = useState(new Set());
  const [memberSearch, setMemberSearch]            = useState('');

  useEffect(() => {
    fetch(MEMBERS_API)
      .then(res => res.json())
      .then(data => setMembers(data.items ?? []))
      .catch(() => {});
  }, []);

  async function getToken() {
    const user = await userManager.getUser();
    return user?.id_token ?? null;
  }

  function toggleMemberSelection(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filteredMembers = members
    .filter(m => m.status !== 'inactive')
    .filter(m => `${m.first_name} ${m.last_name}`.toLowerCase().includes(memberSearch.toLowerCase()))
    .sort((a, b) => (a.last_name ?? '').localeCompare(b.last_name ?? ''));

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
    if (target === 'specific' && selectedIds.size === 0) {
      setError('Select at least one member.');
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
          ...(target === 'specific' ? { member_ids: [...selectedIds] } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setResult(data);
      setSubject('');
      setBody('');
      setAttachments([]);
      setSelectedIds(new Set());
      setShowSpecificPicker(false);
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
          <button
            type="button"
            disabled={sending || uploading || !subject.trim() || !body.trim()}
            onClick={() => setShowSpecificPicker(v => !v)}
            style={{
              background: showSpecificPicker ? '#16213e' : 'transparent',
              color: sending || uploading || !subject.trim() || !body.trim() ? '#666' : '#6ea8fe',
              border: '1px solid #6ea8fe55',
              borderRadius: 6,
              padding: '0.5rem 1.25rem',
              fontWeight: 600,
              cursor: sending || uploading || !subject.trim() || !body.trim() ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Send to Specific Members
          </button>
        </div>

        {showSpecificPicker && (
          <div style={{ marginTop: '1rem', border: '1px solid #444', borderRadius: 8, padding: '0.85rem' }}>
            <label style={labelStyle}>Select Members ({selectedIds.size} selected)</label>
            <input
              type="text"
              style={{ ...inputStyle, marginBottom: '0.6rem' }}
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              placeholder="Search members..."
              disabled={sending}
            />
            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #333', borderRadius: 6, marginBottom: '0.75rem' }}>
              {filteredMembers.length === 0 ? (
                <p style={{ color: '#888', fontSize: '0.85rem', padding: '0.5rem', margin: 0 }}>No members found.</p>
              ) : (
                filteredMembers.map(m => {
                  const id = String(m.member_id);
                  const selected = selectedIds.has(id);
                  return (
                    <label
                      key={id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '5px 10px',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        background: selected ? 'rgba(110, 168, 254, 0.12)' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleMemberSelection(id)}
                        disabled={sending}
                      />
                      {m.last_name}, {m.first_name}
                    </label>
                  );
                })
              )}
            </div>
            <button
              type="button"
              disabled={sending || uploading || !subject.trim() || !body.trim() || selectedIds.size === 0}
              onClick={() => handleSend('specific')}
              style={{
                background: sending || uploading || !subject.trim() || !body.trim() || selectedIds.size === 0 ? '#333' : '#0e2a1a',
                color: sending || uploading || !subject.trim() || !body.trim() || selectedIds.size === 0 ? '#666' : '#75b798',
                border: '1px solid #75b79855',
                borderRadius: 6,
                padding: '0.5rem 1.25rem',
                fontWeight: 600,
                cursor: sending || uploading || !subject.trim() || !body.trim() || selectedIds.size === 0 ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
              }}
            >
              {sending ? 'Sending...' : `Send to ${selectedIds.size} Selected`}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
