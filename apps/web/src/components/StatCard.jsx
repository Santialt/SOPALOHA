function StatCard({ label, value, tone = 'neutral' }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </article>
  );
}

export default StatCard;