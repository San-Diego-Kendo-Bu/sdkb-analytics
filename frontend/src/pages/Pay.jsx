import { useState, useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { userManager } from '../js/cognitoManager';
import styles from '../../css/pay.module.css';
import { isOffHours, OFF_HOURS_MSG } from '../js/offHours';
import OffHoursCard from '../react_components/OffHoursCard';

const BASE_URL = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';
const MEMBERS_API = `${BASE_URL}/members`;
const ASSIGNED_PAYMENTS_API = `${BASE_URL}/assignedpayments`;
const PAYMENTS_API = `${BASE_URL}/payments`;
const PAYMENT_INTENT_API = `${BASE_URL}/payments/intent`;
const SUBMIT_PAYMENT_API = `${BASE_URL}/submittedpayments`;

const STRIPE_APPEARANCE = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#0d6efd',
    borderRadius: '6px',
    fontSizeBase: '15px',
  },
};

const COMPLETED_PAGE_SIZE = 3;

function PaymentForm({ onSuccess, onCancel, submitting, setSubmitting }) {
  const stripe = useStripe();
  const elements = useElements();
  const [payError, setPayError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setPayError('');

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      setPayError(error.message);
      setSubmitting(false);
    } else if (paymentIntent?.status === 'succeeded') {
      await onSuccess();
    } else {
      setPayError('Payment was not completed. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.stripeForm}>
      <PaymentElement />
      {payError && <p className={styles.fieldError}>{payError}</p>}
      <div className={styles.formActions}>
        <button type="submit" disabled={submitting || !stripe} className={styles.confirmBtn}>
          {submitting ? 'Processing...' : 'Confirm Payment'}
        </button>
        <button type="button" onClick={onCancel} disabled={submitting} className={styles.cancelBtn}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Pay({ autoPaymentId, onAutoPayConsumed }) {
  const [assignedPayments, setAssignedPayments] = useState([]);
  const [completedPayments, setCompletedPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);
  const [stripeData, setStripeData] = useState(null);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [completedSearch, setCompletedSearch] = useState('');
  const [completedPage, setCompletedPage] = useState(0);
  const memberIdRef = useRef(null);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function resolveMemberId() {
    if (memberIdRef.current !== null) return memberIdRef.current;
    const user = await userManager.getUser();
    if (!user || user.expired) return null;
    const username = user.profile?.preferred_username;
    if (!username) return null;
    const res = await fetch(`${MEMBERS_API}?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    const memberId = data.items?.[0]?.member_id ?? null;
    memberIdRef.current = memberId;
    return memberId;
  }

  async function loadPayments() {
    setLoading(true);
    try {
      const memberId = await resolveMemberId();
      if (memberId === null) {
        setLoading(false);
        return;
      }

      const [assignedRes, paymentsRes, submittedRes] = await Promise.all([
        fetch(ASSIGNED_PAYMENTS_API),
        fetch(PAYMENTS_API),
        fetch(SUBMIT_PAYMENT_API),
      ]);
      const [assignedData, paymentsData, submittedData] = await Promise.all([
        assignedRes.json(),
        paymentsRes.json(),
        submittedRes.json(),
      ]);

      const allAssigned = assignedData.data ?? [];
      const allPayments = paymentsData.data ?? [];
      const allSubmitted = submittedData.data ?? [];

      const paymentMap = Object.fromEntries(allPayments.map(p => [String(p.payment_id), p]));

      const mine = allAssigned
        .filter(a => Number(a.member_id) === Number(memberId))
        .map(a => ({ ...a, ...paymentMap[String(a.payment_id)] }));

      const myCompleted = allSubmitted
        .filter(s => Number(s.member_id) === Number(memberId))
        .map(s => ({ ...s, ...paymentMap[String(s.payment_id)] }))
        .sort((a, b) => new Date(b.submitted_on) - new Date(a.submitted_on));

      setAssignedPayments(mine);
      setCompletedPayments(myCompleted);
    } catch (err) {
      console.error('loadPayments error:', err);
    }
    setLoading(false);
  }

  useEffect(() => { if (!isOffHours()) loadPayments(); else setLoading(false); }, []);

  useEffect(() => { setCompletedPage(0); }, [completedSearch]);

  const autoTriggeredRef = useRef(false);
  useEffect(() => {
    if (!autoPaymentId || loading || autoTriggeredRef.current) return;
    const payment = assignedPayments.find(p => String(p.payment_id) === String(autoPaymentId));
    if (payment) {
      autoTriggeredRef.current = true;
      handlePayClick(payment);
      if (onAutoPayConsumed) onAutoPayConsumed();
    }
  }, [autoPaymentId, loading, assignedPayments]);

  async function handlePayClick(payment) {
    if (isOffHours()) { showToast(OFF_HOURS_MSG); return; }
    setPayingId(payment.payment_id);
    setStripeData(null);
    setLoadingIntent(true);
    try {
      const memberId = await resolveMemberId();
      const res = await fetch(PAYMENT_INTENT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, payment_id: payment.payment_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create payment intent');
      const stripePromise = loadStripe(data.publishable_key);
      setStripeData({ clientSecret: data.client_secret, stripePromise });
    } catch (err) {
      console.error('handlePayClick error:', err);
      setPayingId(null);
    }
    setLoadingIntent(false);
  }

  async function handlePaymentSuccess() {
    setPayingId(null);
    setStripeData(null);
    setSubmitting(false);
    showToast('Payment successful! Your history will update shortly.');
    // Stripe webhook records the submission server-side; give it a moment before reloading
    setTimeout(loadPayments, 2500);
  }

  function handleCancel() {
    setPayingId(null);
    setStripeData(null);
    setSubmitting(false);
  }

  const filteredCompleted = completedPayments.filter(p =>
    (p.title ?? '').toLowerCase().includes(completedSearch.toLowerCase())
  );
  const totalPages = Math.ceil(filteredCompleted.length / COMPLETED_PAGE_SIZE);
  const pageItems = filteredCompleted.slice(
    completedPage * COMPLETED_PAGE_SIZE,
    (completedPage + 1) * COMPLETED_PAGE_SIZE
  );

  if (loading) return <div className={styles.page}><p className={styles.loadingText}>Loading your payments...</p></div>;
  if (isOffHours()) return <OffHoursCard />;

  return (
    <div className={styles.page}>
    <div className={styles.container}>
      <h2 className={styles.heading}>My Payments</h2>

      {assignedPayments.length === 0 ? (
        <div className={styles.emptyCard}>
          <p>No pending payments.</p>
        </div>
      ) : (
        assignedPayments.map(p => {
          const isThisOne = payingId === p.payment_id;
          const isOverdue = p.due_date ? new Date().toISOString().slice(0, 10) > p.due_date.slice(0, 10) : p.due_status === 'overdue';
          const statusLabel = isOverdue ? 'overdue' : 'due';

          const base = Number(p.payment_value ?? 0);
          const penalty = isOverdue && p.overdue_penalty ? Number(p.overdue_penalty) : 0;
          const total = base + penalty;

          return (
            <div key={p.payment_id} className={styles.card}>
              <div className={styles.cardInfo}>
                <strong>{p.title ?? `Payment #${p.payment_id}`}</strong>
                <span className={`${styles.status} ${isOverdue ? styles.overdue : ''}`}>
                  {statusLabel}
                </span>
              </div>
              <div className={styles.amountRow}>
                {isOverdue && penalty > 0 ? (
                  <>
                    <span className={styles.totalAmount}>${total.toFixed(2)} total</span>
                    <span className={styles.amountBreakdown}>
                      ${base.toFixed(2)} base + ${penalty.toFixed(2)} overdue penalty
                    </span>
                  </>
                ) : (
                  <span className={styles.amount}>${base.toFixed(2)}</span>
                )}
                {p.due_date && (
                  <span className={styles.due}>
                    Due: {new Date(p.due_date).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                  </span>
                )}
              </div>

              {isThisOne && loadingIntent && (
                <p className={styles.loadingInline}>Loading payment form...</p>
              )}

              {isThisOne && stripeData && (
                <Elements
                  stripe={stripeData.stripePromise}
                  options={{ clientSecret: stripeData.clientSecret, appearance: STRIPE_APPEARANCE }}
                >
                  <PaymentForm
                    onSuccess={handlePaymentSuccess}
                    onCancel={handleCancel}
                    submitting={submitting}
                    setSubmitting={setSubmitting}
                  />
                </Elements>
              )}

              {!isThisOne && (
                <button
                  className={styles.payBtn}
                  onClick={() => handlePayClick(p)}
                  disabled={payingId !== null}
                >
                  Pay Now
                </button>
              )}
            </div>
          );
        })
      )}

      {/* Completed Payments */}
      <div className={styles.completedSection}>
        <button
          className={styles.completedToggle}
          onClick={() => setShowCompleted(s => !s)}
        >
          <span>{showCompleted ? '▲' : '▼'}</span>
          Completed Payments ({completedPayments.length})
        </button>

        {showCompleted && (
          <div className={styles.completedBody}>
            <input
              className={styles.completedSearch}
              placeholder="Search by payment title..."
              value={completedSearch}
              onChange={e => setCompletedSearch(e.target.value)}
            />

            {filteredCompleted.length === 0 ? (
              <p className={styles.emptyCompleted}>No completed payments found.</p>
            ) : (
              <>
                {pageItems.map(p => (
                  <div key={p.payment_id} className={styles.completedCard}>
                    <div className={styles.completedCardInfo}>
                      <strong>{p.title ?? `Payment #${p.payment_id}`}</strong>
                      {p.overdue && <span className={styles.overdueTag}>Late</span>}
                    </div>
                    <div className={styles.completedCardMeta}>
                      <span>${Number(p.total_paid ?? 0).toFixed(2)} paid</span>
                      <span>·</span>
                      <span>{new Date(p.submitted_on).toLocaleDateString('en-US', { timeZone: 'UTC' })}</span>
                    </div>
                  </div>
                ))}

                {filteredCompleted.length > COMPLETED_PAGE_SIZE && (
                  <div className={styles.pagination}>
                    <button
                      className={styles.pageBtn}
                      onClick={() => setCompletedPage(p => p - 1)}
                      disabled={completedPage === 0}
                    >
                      ← Prev
                    </button>
                    <span className={styles.pageInfo}>
                      {completedPage + 1} / {totalPages}
                    </span>
                    <button
                      className={styles.pageBtn}
                      onClick={() => setCompletedPage(p => p + 1)}
                      disabled={completedPage >= totalPages - 1}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
    </div>
  );
}
