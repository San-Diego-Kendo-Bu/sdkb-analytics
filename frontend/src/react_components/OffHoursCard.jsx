import { offHoursMessage } from '../js/offHours';

export default function OffHoursCard() {
  const now = new Date();
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const isWeekend = pt.getDay() === 0 || pt.getDay() === 6;
  const resumeTime = isWeekend ? '5am PT' : '7am PT';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4rem 1rem',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🌙</div>
      <h4 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>We're closed for the night</h4>
      <p className="text-muted mb-0" style={{ maxWidth: 320 }}>
        {offHoursMessage()}
        <br />
        Please come back after <strong>{resumeTime}</strong>.
      </p>
    </div>
  );
}
