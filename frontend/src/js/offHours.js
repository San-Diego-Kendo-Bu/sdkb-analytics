export function isOffHours() {
  const now = new Date();
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const hour = pt.getHours();
  const day = pt.getDay(); // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 6;
  return isWeekend ? (hour >= 2 && hour < 5) : (hour >= 2 && hour < 7);
}

export function offHoursMessage() {
  const now = new Date();
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const day = pt.getDay();
  const isWeekend = day === 0 || day === 6;
  return isWeekend
    ? 'The portal is in maintenance mode (2–5am PT on weekends). Please try again after 5am.'
    : 'The portal is in maintenance mode (2–7am PT on weekdays). Please try again after 7am.';
}

export const OFF_HOURS_MSG = offHoursMessage();

// Payments close earlier than general maintenance mode: a checkout can be initiated while
// the DB is still up but not finish (Stripe confirmation + webhook) until after the RDS
// instance is stopped, silently losing the submission. Closing new payments at midnight —
// 2 hours before the actual stop time (2am, both weekdays and weekends) — leaves headroom
// for in-flight checkouts to complete, and lines up with when most payments are due anyway.
export function isPaymentsClosed() {
  const now = new Date();
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const hour = pt.getHours();
  const day = pt.getDay();
  const isWeekend = day === 0 || day === 6;
  return hour < (isWeekend ? 5 : 7);
}

export function paymentsClosedMessage() {
  const now = new Date();
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const day = pt.getDay();
  const isWeekend = day === 0 || day === 6;
  return isWeekend
    ? 'Payments close at midnight PT to leave time for processing before maintenance (2–5am PT). Please try again after 5am.'
    : 'Payments close at midnight PT to leave time for processing before maintenance (2–7am PT). Please try again after 7am.';
}

export const PAYMENTS_CLOSED_MSG = paymentsClosedMessage();

// "Today" for due-date/overdue comparisons needs to be the dojo's own calendar day (Pacific),
// not UTC's. UTC rolls over to the next calendar date at 5pm PDT / 4pm PST — comparing against
// new Date().toISOString().slice(0, 10) made everything look overdue several hours early, every
// single evening, in the dojo's own timezone. Pass an explicit Date to get ITS Pacific calendar
// day instead of today's — e.g. to find what Pacific day an event's real datetime falls on.
export function pacificDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = type => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function pacificToday() {
  return pacificDateString();
}
