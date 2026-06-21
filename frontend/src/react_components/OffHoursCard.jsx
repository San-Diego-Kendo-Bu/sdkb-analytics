export default function OffHoursCard() {
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
        The portal is offline midnight – 7am PT for maintenance.
        <br />
        Please come back after <strong>7am PT</strong>.
      </p>
    </div>
  );
}
