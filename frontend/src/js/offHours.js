export const OFF_HOURS_MSG =
  'The portal is in maintenance mode (midnight–7am PT). Please try again after 7am.';

export function isOffHours() {
  const ptHour = parseInt(
    new Date().toLocaleString('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/Los_Angeles',
    }),
    10
  );
  return ptHour < 7;
}
