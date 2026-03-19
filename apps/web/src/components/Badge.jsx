function Badge({ tone = 'neutral', children, className = '' }) {
  const classes = ['ui-badge', `ui-badge-${tone}`, className].filter(Boolean).join(' ');
  return <span className={classes}>{children}</span>;
}

export default Badge;
