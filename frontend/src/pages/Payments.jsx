import { useState, useEffect } from 'react';
import { userManager } from '../js/cognitoManager';
import PaymentEntry from '../react_components/PaymentEntry';
import styles from '../../css/paymentpage.module.css';
import { isOffHours, OFF_HOURS_MSG } from '../js/offHours';
import OffHoursCard from '../react_components/OffHoursCard';

const BASE_URL = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';
const PAYMENTS_API = `${BASE_URL}/payments`;
const MEMBERS_API = `${BASE_URL}/members`;
const ASSIGNED_PAYMENTS_API = `${BASE_URL}/assignedpayments`;

const EMPTY_FORM = { title: '', payment_value: '', due_date: '', overdue_penalty: '', is_dojo_due: false };

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
      <label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={form.is_dojo_due}
          onChange={e => setForm(f => ({ ...f, is_dojo_due: e.target.checked }))} />
        Dojo Due (broadcast to members; cannot be linked to events)
      </label>
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
  const [filter, setFilter] = useState('All');
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
      is_dojo_due: p.is_dojo_due ?? false,
    };
  }

  useEffect(() => {
    if (isOffHours()) { setLoading(false); return; }
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

  const filtered = payments
    .filter(p => {
      const isPast = p.due_date ? new Date().toISOString().slice(0, 10) > p.due_date.slice(0, 10) : false;
      const matchFilter = filter === 'All' || (filter === 'Past' ? isPast : !isPast);
      return matchFilter && p.title.toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => new Date(b.due_date) - new Date(a.due_date));

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
      is_dojo_due: newForm.is_dojo_due,
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
      is_dojo_due: p.is_dojo_due ?? false,
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
      is_dojo_due: editForm.is_dojo_due,
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
    const due_status = payment.due_date && new Date().toISOString().slice(0, 10) > payment.due_date.slice(0, 10) ? 'overdue' : 'due';
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

  function calcAge(birthday) {
    if (!birthday) return null;
    const today = new Date();
    const dob = new Date(birthday);
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }

  async function handleBroadcast(payment, mode = 'all') {
    if (isOffHours()) { setError(OFF_HOURS_MSG); return; }
    if (!members.length) { setError('No members loaded.'); return; }
    const due_status = payment.due_date && new Date().toISOString().slice(0, 10) > payment.due_date.slice(0, 10) ? 'overdue' : 'due';
    setAssigningId(null);
    setAssignMemberId('');

    const active = m => m.status !== 'guest' && m.status !== 'inactive';
    const notSensei = m => m.rank_type !== 'shihan' && !(m.rank_type === 'dan' && Number(m.rank_number) >= 4);

    let targets;
    let label;
    if (mode === 'adults') {
      targets = members.filter(m => active(m) && notSensei(m));
      label = 'adults (3-dan & below)';
    } else if (mode === 'students') {
      targets = members.filter(m => active(m) && m.is_student === true && (calcAge(m.birthday) ?? 0) >= 18);
      label = 'university students';
    } else if (mode === 'kids') {
      targets = members.filter(m => active(m) && (calcAge(m.birthday) ?? Infinity) <= 18);
      label = 'kids (18 & under)';
    } else {
      targets = members;
      label = 'all members';
    }

    const user = await userManager.getUser();
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id_token}` };
    const results = await Promise.allSettled(
      targets.map(m => fetch(ASSIGNED_PAYMENTS_API, {
        method: 'POST',
        headers,
        body: JSON.stringify({ member_id: m.member_id, payment_id: payment.payment_id, due_status }),
      }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); }))
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    showToast(failed > 0
      ? `Assigned to ${succeeded} ${label} (${failed} already assigned or failed).`
      : `Payment assigned to ${succeeded} ${label}!`
    );
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

      <div className={styles.filters}>
        <span className={styles.filtersLabel}>Filter:</span>
        {['All', 'Active', 'Past'].map(f => (
          <button
            key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
            onClick={() => setFilter(f)}
          >{f}</button>
        ))}
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
        {!loading && isOffHours() && <OffHoursCard />}
        {!isOffHours() && error && <p className={styles.empty}>Error: {error}</p>}
        {!loading && !error && !isOffHours() && filtered.length === 0 && <p className={styles.empty}>No payments found.</p>}
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
                    is_dojo_due={p.is_dojo_due}
                    actions={<>
                      <button className={styles.editBtn} onClick={() => { handleEditOpen(p); setShowNew(false); setAssigningId(null); }}>Edit</button>
                      <button className={styles.editBtn} onClick={() => { setAssigningId(id => id === p.payment_id ? null : p.payment_id); setAssignMemberId(''); setEditingId(null); setShowNew(false); }}>Assign</button>
                      <button className={styles.deleteBtn} onClick={() => handleDelete(p.payment_id)}>Delete</button>
                    </>}
                  />
                  {assigningId === p.payment_id && (
                    <div className={styles.formBox} style={{ margin: '0.75rem 0 0.75rem 1.5rem' }}>
                      <p className={styles.formTitle}>Assign to Member</p>
                      <select className={styles.input} value={assignMemberId} onChange={e => setAssignMemberId(e.target.value)}>
                        <option value="">Select member</option>
                        {members.map(m => (
                          <option key={m.member_id} value={m.member_id}>
                            {m.first_name} {m.last_name} (#{m.member_id})
                          </option>
                        ))}
                      </select>
                      <div className={styles.formActions} style={{ flexWrap: 'wrap' }}>
                        <button className={styles.saveBtn} onClick={() => handleAssign(p)} disabled={!assignMemberId}>Assign</button>
                        {p.is_dojo_due && <>
                          <button className={styles.saveBtn} onClick={() => handleBroadcast(p, 'adults')} style={{ background: '#32cd32' }}>Assign to Adults (3-Dan & Below)</button>
                          <button className={styles.saveBtn} onClick={() => handleBroadcast(p, 'students')} style={{ background: '#1565c0' }}>Assign to University Students</button>
                          <button className={styles.saveBtn} onClick={() => handleBroadcast(p, 'kids')} style={{ background: '#6a1b9a' }}>Assign to Kids (18 & Under)</button>
                          <button className={styles.saveBtn} onClick={() => handleBroadcast(p, 'all')} style={{ background: '#157347' }}>Assign to All</button>
                        </>}
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
