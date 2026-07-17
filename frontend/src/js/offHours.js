export function isOffHours() {
  const now = new Date();
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const hour = pt.getHours();
  const day = pt.getDay(); // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 6;
  return isWeekend ? (hour >= 2 && hour < 5) : (hour >= 1 && hour < 7);
}

export function offHoursMessage() {
  const now = new Date();
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const day = pt.getDay();
  const isWeekend = day === 0 || day === 6;
  return isWeekend
    ? 'The portal is in maintenance mode (2–5am PT on weekends). Please try again after 5am.'
    : 'The portal is in maintenance mode (1–7am PT on weekdays). Please try again after 7am.';
}

export const OFF_HOURS_MSG = offHoursMessage();
