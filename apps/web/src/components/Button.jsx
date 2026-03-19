function Button({
  as: Component = 'button',
  variant = 'secondary',
  className = '',
  type,
  children,
  ...props
}) {
  const resolvedType = Component === 'button' ? type || 'button' : type;
  const classes = ['ui-button', `ui-button-${variant}`, className].filter(Boolean).join(' ');

  return (
    <Component className={classes} type={resolvedType} {...props}>
      {children}
    </Component>
  );
}

export default Button;
