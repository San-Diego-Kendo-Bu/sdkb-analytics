import { useState, useEffect } from 'react';
import { userManager } from '../js/cognitoManager';
import PaymentEntry from '../react_components/PaymentEntry';
import styles from '../../css/paymentpage.module.css';
import { isOffHours, OFF_HOURS_MSG } from '../js/offHours';

const BASE_URL = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';
const PAYMENTS_API = `${BASE_URL}/payments`;
const MEMBERS_API = `${BASE_URL}/members`;
const ASSIGNED_PAYMENTS_API = `${BASE_URL}/assignedpayments`;

const EMPTY_FORM = { title: '', payment_value: '', due_date: '', overdue_penalty: '' };

function toInputDate(iso) {
  return iso ? iso.slice(0, 10) : '';
}

function toIsoDate(inputValue) {
  return inputValue ? inputValue + 'T00:00:00.000Z' : null;
}

function PaymentForm({ form, setForm, onSave, onCancel, title }) {
  return (
    <div className={styles.formBox}>
      <p className={styles.formTitle}>{title}</p>
      <input className={styles.input} placeholder="Title" value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
      <label className={styles.label}>Amount ($)</label>
      <input className={styles.input} type="number" min="0" step="0.01" placeholder="0.00" value={form.payment_value}
        onChange={e => setForm(f => ({ ...f, payment_value: e.target.value }))} />
      <label className={styles.label}>Due Date</label>
      <input className={styles.input} type="date" value={form.due_date}
        onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
      <label className={styles.label}>Overdue Penalty ($, optional)</label>
      <input className={styles.input} type="number" min="0" step="0.01" placeholder="0.00" value={form.overdue_penalty}
        onChange={e => setForm(f => ({ ...f, overdue_penalty: e.target.value }))} />
      <div className={styles.formActions}>
        <button className={styles.saveBtn} onClick={onSave}>Save</button>
        <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function Payments() {
  const [payments, setPayments] = useState([]);
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assigningId, setAssigningId] = useState(null);
  const [assignMemberId, setAssignMemberId] = useState('');
  const [toast, setToast] = useState('');

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function mapPayment(p) {
    return {
      payment_id: p.payment_id,
      title: p.title,
      created_at: p.created_at,
      due_date: p.due_date,
      payment_value: Number(p.payment_value),
      overdue_penalty: p.overdue_penalty != null ? Number(p.overdue_penalty) : null,
    };
  }

  useEffect(() => {
    Promise.all([
      fetch(PAYMENTS_API).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch(MEMBERS_API).then(r => r.json()).catch(() => ({ items: [] })),
    ])
      .then(([paymentsData, membersData]) => {
        setPayments((paymentsData.data ?? []).map(mapPayment));
        setMembers(membersData.items ?? []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = payments.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  function handleCreate() {
    if (isOffHours()) { setError(OFF_HOURS_MSG); return; }
    if (!newForm.title || !newForm.payment_value || !newForm.due_date) {
      setError('Title, amount, and due date are required.');
      return;
    }
    const payload = {
      title: newForm.title,
      payment_value: parseFloat(newForm.payment_value),
      due_date: toIsoDate(newForm.due_date),
      overdue_penalty: newForm.overdue_penalty ? parseFloat(newForm.overdue_penalty) : null,
      created_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    };
    setShowNew(false);
    setNewForm(EMPTY_FORM);
    userManager.getUser()
      .then(user => fetch(PAYMENTS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id_token}` },
        body: JSON.stringify(payload),
      }))
      .then(res => { if (!res.ok) return res.json().then(b => { throw new Error(b.error || `HTTP ${res.status}`); }); return fetch(PAYMENTS_API); })
      .then(res => res.json())
      .then(data => setPayments((data.data ?? []).map(mapPayment)))
      .catch(err => setError(err.message));
  }

  function handleEditOpen(p) {
    setEditingId(p.payment_id);
    setEditForm({
      title: p.title,
      payment_value: String(p.payment_value),
      due_date: toInputDate(p.due_date),
      overdue_penalty: p.overdue_penalty != null ? String(p.overdue_penalty) : '',
    });
  }

  function handleEditSave() {
    if (isOffHours()) { setError(OFF_HOURS_MSG); return; }
    if (!editForm.title || !editForm.payment_value || !editForm.due_date) {
      setError('Title, amount, and due date are required.');
      return;
    }
    const payload = {
      payment_id: editingId,
      title: editForm.title,
      payment_value: parseFloat(editForm.payment_value),
      due_date: toIsoDate(editForm.due_date),
      overdue_penalty: editForm.overdue_penalty ? parseFloat(editForm.overdue_penalty) : null,
    };
    setEditingId(null);
    userManager.getUser()
      .then(user => fetch(PAYMENTS_API, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id_token}` },
        body: JSON.stringify(payload),
      }))
      .then(res => { if (!res.ok) return res.json().then(b => { throw new Error(b.message || b.error || `HTTP ${res.status}`); }); return fetch(PAYMENTS_API); })
      .then(res => res.json())
      .then(data => setPayments((data.data ?? []).map(mapPayment)))
      .catch(err => setError(err.message));
  }

  function handleAssign(payment) {
    if (isOffHours()) { setError(OFF_HOURS_MSG); return; }
    if (!assignMemberId) return;
    const today = new Date();
    const dueDate = payment.due_date ? new Date(payment.due_date) : null;
    const due_status = dueDate && today > dueDate ? 'overdue' : 'due';
    const selectedMemberId = assignMemberId;
    const member = members.find(m => String(m.member_id) === String(selectedMemberId));
    const memberName = member ? `${member.first_name} ${member.last_name}` : `Member #${selectedMemberId}`;
    setAssigningId(null);
    setAssignMemberId('');
    userManager.getUser()
      .then(user => fetch(ASSIGNED_PAYMENTS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id_token}` },
        body: JSON.stringify({ member_id: parseInt(selectedMemberId, 10), payment_id: payment.payment_id, due_status }),
      }))
      .then(res => { if (!res.ok) return res.json().then(b => { throw new Error(b.error || b.message || `HTTP ${res.status}`); }); })
      .then(() => showToast(`Payment assigned to ${memberName} successfully!`))
      .catch(err => setError(err.message));
  }

  function handleDelete(id) {
    if (isOffHours()) { setError(OFF_HOURS_MSG); return; }
    userManager.getUser()
      .then(user => fetch(PAYMENTS_API, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id_token}` },
        body: JSON.stringify({ payment_id: id }),
      }))
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); })
      .then(() => setPayments(prev => prev.filter(p => p.payment_id !== id)))
      .catch(err => setError(err.message));
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Payments</h2>
          <span className={styles.count}>{payments.length} payments</span>
        </div>
        <div className={styles.headerRight}>
          <input
            className={styles.search}
            placeholder="Search payments..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className={styles.newBtn} onClick={() => { setShowNew(s => !s); setEditingId(null); }}>
            + New payment
          </button>
        </div>
      </div>

      {showNew && (
        <PaymentForm
          title="New Payment"
          form={newForm}
          setForm={setNewForm}
          onSave={handleCreate}
          onCancel={() => setShowNew(false)}
        />
      )}

      <div className={styles.list}>
        {loading && <p className={styles.empty}>Loading payments...</p>}
        {error && <p className={styles.empty}>Error: {error}</p>}
        {!loading && !error && filtered.length === 0 && <p className={styles.empty}>No payments found.</p>}
        {filtered.map(p => {
          const isEditing = editingId === p.payment_id;
          return (
            <div key={p.payment_id}>
              {isEditing ? (
                <PaymentForm
                  title="Edit Payment"
                  form={editForm}
                  setForm={setEditForm}
                  onSave={handleEditSave}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div>
                  <PaymentEntry
                    id={p.payment_id}
                    title={p.title}
                    created_at={p.created_at}
                    due_date={p.due_date}
                    payment_value={p.payment_value}
                    overdue_penalty={p.overdue_penalty}
                  />
                  <div className={styles.cardActions} style={{ paddingLeft: '1.5rem', paddingBottom: '0.75rem', marginTop: '-0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button className={styles.editBtn} onClick={() => { handleEditOpen(p); setShowNew(false); setAssigningId(null); }}>
                      Edit
                    </button>
                    <button className={styles.editBtn} onClick={() => { setAssigningId(id => id === p.payment_id ? null : p.payment_id); setAssignMemberId(''); setEditingId(null); setShowNew(false); }}>
                      Assign
                    </button>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(p.payment_id)}>
                      Delete
                    </button>
                  </div>
                  {assigningId === p.payment_id && (
                    <div className={styles.formBox} style={{ margin: '0 0 0.75rem 1.5rem' }}>
                      <p className={styles.formTitle}>Assign to Member</p>
                      <select className={styles.input} value={assignMemberId} onChange={e => setAssignMemberId(e.target.value)}>
                        <option value="">Select member</option>
                        {members.map(m => (
                          <option key={m.member_id} value={m.member_id}>
                            {m.first_name} {m.last_name} (#{m.member_id})
                          </option>
                        ))}
                      </select>
                      <div className={styles.formActions}>
                        <button className={styles.saveBtn} onClick={() => handleAssign(p)} disabled={!assignMemberId}>Assign</button>
                        <button className={styles.cancelBtn} onClick={() => { setAssigningId(null); setAssignMemberId(''); }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}

export default Payments;
