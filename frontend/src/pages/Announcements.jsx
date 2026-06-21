import { useState, useRef } from 'react';
import { userManager } from '../js/cognitoManager';
import { isOffHours, OFF_HOURS_MSG } from '../js/offHours';

const BASE_URL          = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';
const UPLOAD_URL_API    = `${BASE_URL}/announcements/upload-url`;
const SEND_API          = `${BASE_URL}/announcements/send`;

export default function Announcements() {
  const [subject, setSubject]       = useState('');
  const [body, setBody]             = useState('');
  const [pdfUrl, setPdfUrl]         = useState(null);
  const [pdfName, setPdfName]       = useState(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [sending, setSending]       = useState(false);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState('');
  const fileInputRef                = useRef(null);

  async function getToken() {
    const user = await userManager.getUser();
    return user?.id_token ?? null;
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported.');
      return;
    }

    setUploadingPdf(true);
    setError('');
    setPdfUrl(null);
    setPdfName(null);

    try {
      const token = await getToken();
      const res = await fetch(
        `${UPLOAD_URL_API}?filename=${encodeURIComponent(file.name)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get upload URL');

      await fetch(data.upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': 'application/pdf' },
      });

      setPdfUrl(data.pdf_url);
      setPdfName(file.name);
    } catch (err) {
      setError(`PDF upload failed: ${err.message}`);
    }
    setUploadingPdf(false);
  }

  async function handleSend(e) {
    e.preventDefault();
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subject, body, pdf_url: pdfUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setResult(data);
      setSubject('');
      setBody('');
      setPdfUrl(null);
      setPdfName(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err.message);
    }
    setSending(false);
  }

  function handleRemovePdf() {
    setPdfUrl(null);
    setPdfName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h4 className="mb-1">Send Announcement</h4>
      <p className="text-muted mb-4" style={{ fontSize: '0.875rem' }}>
        Sends an email to all members. Attach a PDF newsletter if needed.
      </p>

      <form onSubmit={handleSend}>
        {/* Subject */}
        <div className="mb-3">
          <label className="form-label fw-semibold">Subject</label>
          <input
            type="text"
            className="form-control"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="e.g. June Newsletter"
            disabled={sending}
          />
        </div>

        {/* Body */}
        <div className="mb-3">
          <label className="form-label fw-semibold">Message</label>
          <textarea
            className="form-control"
            rows={6}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your announcement here..."
            disabled={sending}
          />
        </div>

        {/* PDF attachment */}
        <div className="mb-4">
          <label className="form-label fw-semibold">Newsletter PDF <span className="text-muted fw-normal">(optional)</span></label>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPdf || sending}
            >
              {uploadingPdf ? 'Uploading...' : 'Attach PDF'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {pdfName && (
              <span className="d-flex align-items-center gap-1" style={{ fontSize: '0.875rem' }}>
                <span style={{ color: '#198754' }}>📄 {pdfName}</span>
                <button
                  type="button"
                  onClick={handleRemovePdf}
                  disabled={sending}
                  style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', padding: '0 4px', fontSize: '1rem', lineHeight: 1 }}
                >
                  ✕
                </button>
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="alert alert-danger py-2 mb-3" style={{ fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {result && (
          <div className="alert alert-success py-2 mb-3" style={{ fontSize: '0.875rem' }}>
            {result.message}
            {result.failed > 0 && (
              <div className="mt-1 text-muted" style={{ fontSize: '0.8rem' }}>
                Failed addresses: {result.failures.join(', ')}
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={sending || uploadingPdf || !subject.trim() || !body.trim()}
        >
          {sending ? 'Sending...' : 'Send to All Members'}
        </button>
      </form>
    </div>
  );
}
