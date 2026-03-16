function StatCard({ label, value, tone = 'neutral', helper = '', accent = '' }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {accent ? <div className="stat-accent">{accent}</div> : null}
      {helper ? <div className="stat-helper">{helper}</div> : null}
    </article>
  );
}

export default StatCard;
