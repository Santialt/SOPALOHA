import { createElement } from 'react';

function Card({
  as: Component = 'section',
  title,
  subtitle,
  actions,
  className = '',
  bodyClassName = '',
  children
}) {
  return createElement(
    Component,
    { className: ['ui-card', className].filter(Boolean).join(' ') },
    <>
      {(title || subtitle || actions) && (
        <header className="ui-card-header">
          <div className="ui-card-heading">
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div className="ui-card-actions">{actions}</div> : null}
        </header>
      )}
      <div className={['ui-card-body', bodyClassName].filter(Boolean).join(' ')}>{children}</div>
    </>
  );
}

export default Card;
