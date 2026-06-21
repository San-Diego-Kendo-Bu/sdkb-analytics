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

export default function Pay() {
  const [assignedPayments, setAssignedPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);
  const [stripeData, setStripeData] = useState(null);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const memberIdRef = useRef(null);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function resolveMemberId() {
    if (memberIdRef.current !== null) return memberIdRef.current;
    const user = await userManager.getUser();
    if (!user || user.expired) return null;
    const email = user.profile?.email;
    if (!email) return null;
    const res = await fetch(`${MEMBERS_API}?email=${encodeURIComponent(email)}`);
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

      const [assignedRes, paymentsRes] = await Promise.all([
        fetch(ASSIGNED_PAYMENTS_API),
        fetch(PAYMENTS_API),
      ]);
      const [assignedData, paymentsData] = await Promise.all([
        assignedRes.json(),
        paymentsRes.json(),
      ]);

      const allAssigned = assignedData.data ?? [];
      const allPayments = paymentsData.data ?? [];

      const paymentMap = Object.fromEntries(allPayments.map(p => [String(p.payment_id), p]));

      const mine = allAssigned
        .filter(a => Number(a.member_id) === Number(memberId))
        .map(a => ({ ...a, ...paymentMap[String(a.payment_id)] }));

      setAssignedPayments(mine);
    } catch (err) {
      console.error('loadPayments error:', err);
    }
    setLoading(false);
  }

  useEffect(() => { if (!isOffHours()) loadPayments(); else setLoading(false); }, []);

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
    const memberId = await resolveMemberId();
    try {
      await fetch(SUBMIT_PAYMENT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, payment_id: payingId }),
      });
    } catch (err) {
      console.error('submitPayment error:', err);
    }
    setPayingId(null);
    setStripeData(null);
    setSubmitting(false);
    showToast('Payment submitted successfully!');
    loadPayments();
  }

  function handleCancel() {
    setPayingId(null);
    setStripeData(null);
    setSubmitting(false);
  }

  if (loading) return <p className="text-muted p-4">Loading your payments...</p>;
  if (isOffHours()) return <OffHoursCard />;

  return (
    <div className={styles.container}>
      <h4 className="mb-3">My Payments</h4>

      {assignedPayments.length === 0 ? (
        <div className="p-4 bg-white border rounded shadow-sm text-center text-muted">
          <p className="mb-0">No pending payments.</p>
        </div>
      ) : (
        assignedPayments.map(p => {
          const isThisOne = payingId === p.payment_id;
          const isOverdue = p.due_date ? new Date() > new Date(p.due_date) : p.due_status === 'overdue';
          const statusLabel = isOverdue ? 'overdue' : 'due';

          return (
            <div key={p.payment_id} className={styles.card}>
              <div className={styles.cardInfo}>
                <strong>{p.title ?? `Payment #${p.payment_id}`}</strong>
                <span className={styles.amount}>${Number(p.payment_value ?? 0).toFixed(2)}</span>
                {p.due_date && (
                  <span className={styles.due}>
                    Due: {new Date(p.due_date).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                  </span>
                )}
                <span className={`${styles.status} ${isOverdue ? styles.overdue : ''}`}>
                  {statusLabel}
                </span>
              </div>

              {isThisOne && loadingIntent && (
                <p className="text-muted mb-0">Loading payment form...</p>
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

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
