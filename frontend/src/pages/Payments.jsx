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
const RECURRING_API = `${BASE_URL}/recurringpayments`;
const FAMILIES_API = `${BASE_URL}/families`;

const EMPTY_FORM = { title: '', payment_value: '', due_date: '', overdue_penalty: '', is_dojo_due: false };
const EMPTY_RECURRING_FORM = { title: '', payment_value: '', next_due_date: '', overdue_penalty: '', interval_months: '3', broadcast_target: 'all', designated_parents: {} };

const INTERVAL_LABELS = { 3: 'Every 3 months', 6: 'Every 6 months', 9: 'Every 9 months', 12: 'Every year' };
const TARGET_LABELS = {
  all: 'All Active Members',
  dojo_due: 'Active Members (Dojo Due)',
  adults: 'Adults (3-Dan & Below)',
  students: 'University Students',
  kids: 'Kids (18 & Under)',
  families: 'Families (Parents full · Members 50% off)',
};

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
  const [mode, setMode] = useState('oneTime');
  const [recurringPayments, setRecurringPayments] = useState([]);
  const [recurringLoaded, setRecurringLoaded] = useState(false);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [showNewRecurring, setShowNewRecurring] = useState(false);
  const [recurringForm, setRecurringForm] = useState(EMPTY_RECURRING_FORM);
  const [families, setFamilies] = useState([]);
  const [familiesLoading, setFamiliesLoading] = useState(false);

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

    const active = m => m.status === 'active';
    const notSensei = m => m.rank_type !== 'shihan' && !(m.rank_type === 'dan' && Number(m.rank_number) >= 4);

    let targets;
    let label;
    if (mode === 'adults') {
      targets = members.filter(m => active(m) && notSensei(m) && !m.is_student && (calcAge(m.birthday) ?? Infinity) > 18);
      label = 'adults (3-dan & below)';
    } else if (mode === 'students') {
      targets = members.filter(m => active(m) && m.is_student === true);
      label = 'university students';
    } else if (mode === 'kids') {
      targets = members.filter(m => active(m) && !m.is_student && (calcAge(m.birthday) ?? Infinity) <= 18);
      label = 'kids (18 & under)';
    } else {
      targets = members.filter(m => m.status !== 'guest' && m.status !== 'inactive');
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

  async function loadRecurring() {
    if (recurringLoaded) return;
    setRecurringLoading(true);
    try {
      const user = await userManager.getUser();
      const headers = user ? { Authorization: `Bearer ${user.id_token}` } : {};
      const res = await fetch(RECURRING_API, { headers });
      const data = await res.json();
      setRecurringPayments(data.recurring_payments ?? []);
      setRecurringLoaded(true);
    } catch (err) {
      setError(err.message);
    }
    setRecurringLoading(false);
  }

  function switchMode(newMode) {
    setMode(newMode);
    setShowNew(false);
    setEditingId(null);
    setAssigningId(null);
    if (newMode === 'recurring') loadRecurring();
  }

  async function handleCreateRecurring() {
    if (!recurringForm.title || !recurringForm.payment_value || !recurringForm.next_due_date) {
      setError('Title, amount, and first due date are required.');
      return;
    }
    try {
      const user = await userManager.getUser();
      const res = await fetch(RECURRING_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id_token}` },
        body: JSON.stringify({
          title: recurringForm.title,
          payment_value: parseFloat(recurringForm.payment_value),
          next_due_date: recurringForm.next_due_date + 'T00:00:00.000Z',
          overdue_penalty: recurringForm.overdue_penalty ? parseFloat(recurringForm.overdue_penalty) : 0,
          interval_months: parseInt(recurringForm.interval_months, 10),
          broadcast_target: recurringForm.broadcast_target,
          designated_parents: recurringForm.broadcast_target === 'families' ? recurringForm.designated_parents : null,
        }),
      });
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || `HTTP ${res.status}`); }
      const data = await (await fetch(RECURRING_API, { headers: { Authorization: `Bearer ${user.id_token}` } })).json();
      setRecurringPayments(data.recurring_payments ?? []);
      setShowNewRecurring(false);
      setRecurringForm(EMPTY_RECURRING_FORM);
      showToast('Recurring payment created!');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteRecurring(recurringId) {
    try {
      const user = await userManager.getUser();
      const res = await fetch(RECURRING_API, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.id_token}` },
        body: JSON.stringify({ payment_id: recurringId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRecurringPayments(prev => prev.filter(r => r.payment_id !== recurringId));
      showToast('Recurring payment cancelled.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadFamilies() {
    if (families.length > 0) return;
    setFamiliesLoading(true);
    try {
      const res = await fetch(FAMILIES_API);
      const data = await res.json();
      setFamilies(data.families ?? []);
    } catch (err) {
      setError(err.message);
    }
    setFamiliesLoading(false);
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
          {mode === 'oneTime'
            ? <span className={styles.count}>{payments.length} payments</span>
            : <span className={styles.count}>{recurringPayments.length} recurring</span>}
        </div>
        <div className={styles.headerRight}>
          {mode === 'oneTime' ? (<>
            <input
              className={styles.search}
              placeholder="Search payments..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className={styles.newBtn} onClick={() => { setShowNew(s => !s); setEditingId(null); }}>
              + New payment
            </button>
          </>) : (
            <button className={styles.newBtn} onClick={() => setShowNewRecurring(s => !s)}>
              + New recurring
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {[['oneTime', 'One-Time'], ['recurring', 'Recurring']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => switchMode(val)}
            style={{
              padding: '5px 16px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600,
              border: mode === val ? 'none' : '1px solid var(--border)',
              background: mode === val ? '#6ea8fe' : 'transparent',
              color: mode === val ? '#1a1a2e' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.12s',
            }}
          >{label}</button>
        ))}
      </div>

      {mode === 'oneTime' && (<>
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
      </>)}

      {mode === 'recurring' && (
        <div>
          {showNewRecurring && (
            <div className={styles.formBox}>
              <p className={styles.formTitle}>New Recurring Payment</p>
              <input className={styles.input} placeholder="Title" value={recurringForm.title}
                onChange={e => setRecurringForm(f => ({ ...f, title: e.target.value }))} />
              <label className={styles.label}>Amount ($)</label>
              <input className={styles.input} type="number" min="0" step="0.01" placeholder="0.00"
                value={recurringForm.payment_value}
                onChange={e => setRecurringForm(f => ({ ...f, payment_value: e.target.value }))} />
              <label className={styles.label}>First Due Date</label>
              <input className={styles.input} type="date" value={recurringForm.next_due_date}
                onChange={e => setRecurringForm(f => ({ ...f, next_due_date: e.target.value }))} />
              <label className={styles.label}>Overdue Penalty ($, optional)</label>
              <input className={styles.input} type="number" min="0" step="0.01" placeholder="0.00"
                value={recurringForm.overdue_penalty}
                onChange={e => setRecurringForm(f => ({ ...f, overdue_penalty: e.target.value }))} />
              <label className={styles.label}>Repeat Interval</label>
              <select className={styles.input} value={recurringForm.interval_months}
                onChange={e => setRecurringForm(f => ({ ...f, interval_months: e.target.value }))}>
                <option value="3">Every 3 months</option>
                <option value="6">Every 6 months (semi-annual)</option>
                <option value="9">Every 9 months</option>
                <option value="12">Every year (annual)</option>
              </select>
              <label className={styles.label}>Assign To</label>
              <select className={styles.input} value={recurringForm.broadcast_target}
                onChange={e => {
                  const t = e.target.value;
                  setRecurringForm(f => ({ ...f, broadcast_target: t, designated_parents: {} }));
                  if (t === 'families') loadFamilies();
                }}>
                <option value="all">All Active Members</option>
                <option value="dojo_due">Active Members (Dojo Due)</option>
                <option value="adults">Adults (3-Dan & Below)</option>
                <option value="students">University Students</option>
                <option value="kids">Kids (18 & Under)</option>
                <option value="families">Families (Parents full · Members 50% off)</option>
              </select>
              {recurringForm.broadcast_target === 'families' && (
                <div style={{ marginTop: '0.5rem' }}>
                  <label className={styles.label}>Full-Price Parent per Family</label>
                  {familiesLoading && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading families...</p>}
                  {!familiesLoading && families.length === 0 && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No families configured.</p>
                  )}
                  {families.map(fam => {
                    const parents = fam.members.filter(m => m.is_parent);
                    return (
                      <div key={fam.family_id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                        <span style={{ flex: '0 0 140px', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fam.family_name}</span>
                        <select
                          className={styles.input}
                          style={{ flex: 1, margin: 0 }}
                          value={recurringForm.designated_parents[fam.family_id] ?? ''}
                          onChange={e => {
                            const val = e.target.value;
                            setRecurringForm(f => ({
                              ...f,
                              designated_parents: val
                                ? { ...f.designated_parents, [fam.family_id]: Number(val) }
                                : Object.fromEntries(Object.entries(f.designated_parents).filter(([k]) => k !== String(fam.family_id))),
                            }));
                          }}
                          disabled={parents.length === 0}
                        >
                          <option value="">{parents.length === 0 ? 'No parents assigned' : 'Auto (first parent)'}</option>
                          {parents.map(p => {
                            const info = members.find(m => m.member_id === p.member_id);
                            return (
                              <option key={p.member_id} value={p.member_id}>
                                {info ? `${info.first_name} ${info.last_name}` : `Member #${p.member_id}`}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className={styles.formActions}>
                <button className={styles.saveBtn} onClick={handleCreateRecurring}>Save</button>
                <button className={styles.cancelBtn} onClick={() => { setShowNewRecurring(false); setRecurringForm(EMPTY_RECURRING_FORM); }}>Cancel</button>
              </div>
            </div>
          )}
          <div className={styles.list}>
            {recurringLoading && <p className={styles.empty}>Loading...</p>}
            {!recurringLoading && recurringPayments.length === 0 && (
              <p className={styles.empty}>No recurring payments set up. Click "+ New recurring" to create one.</p>
            )}
            {recurringPayments.map(r => (
              <div key={r.payment_id} className={styles.formBox} style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{r.title}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      ${Number(r.payment_value).toFixed(2)}
                      {r.overdue_penalty ? ` · $${Number(r.overdue_penalty).toFixed(2)} overdue penalty` : ''}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                      {INTERVAL_LABELS[r.interval_months] ?? `Every ${r.interval_months} months`}
                      {' · Next: '}
                      {new Date(r.next_due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                    </div>
                    <div style={{ marginTop: '0.4rem' }}>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(110,168,254,0.15)', color: '#6ea8fe', borderRadius: 8, padding: '2px 8px', fontWeight: 600 }}>
                        {TARGET_LABELS[r.broadcast_target] ?? r.broadcast_target}
                      </span>
                    </div>
                  </div>
                  <button className={styles.deleteBtn} onClick={() => handleDeleteRecurring(r.payment_id)}>Cancel</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}

export default Payments;
