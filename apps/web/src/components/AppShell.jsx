import { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { applyTheme, getPreferredTheme } from '../theme';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/locations', label: 'Locales' },
  { to: '/incidents', label: 'Incidentes' },
  { to: '/tasks', label: 'Tareas' },
  { to: '/on-call', label: 'Guardias' },
  { to: '/location-notes', label: 'Notas Tecnicas' },
  { to: '/teamviewer-explorer', label: 'TeamViewer Explorer' },
  { to: '/teamviewer-import', label: 'TeamViewer Import' }
];

const pageTitles = {
  '/dashboard': 'Dashboard Operativo',
  '/locations': 'Gestion de Locales',
  '/incidents': 'Incidentes',
  '/tasks': 'Tareas',
  '/on-call': 'Guardias',
  '/location-notes': 'Notas Tecnicas',
  '/teamviewer-explorer': 'TeamViewer Explorer',
  '/teamviewer-import': 'TeamViewer Import'
};

function resolveTitle(pathname) {
  if (pathname.startsWith('/locations/')) {
    return 'Detalle de Local';
  }

  return pageTitles[pathname] || 'Panel SOPALOHA';
}

function AppShell() {
  const { pathname } = useLocation();
  const [theme, setTheme] = useState(() => getPreferredTheme());
  const headerTitle = useMemo(() => resolveTitle(pathname), [pathname]);

  const onToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(applyTheme(nextTheme));
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">SOPALOHA</div>
        <div className="sidebar-subtitle">OPS Console / Aloha POS</div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="main-header">
          <div>
            <h1>{headerTitle}</h1>
            <div className="header-subtitle">Mesa interna de soporte POS / Aloha</div>
          </div>
          <button type="button" className="theme-toggle" onClick={onToggleTheme}>
            Tema: {theme === 'dark' ? 'Oscuro' : 'Claro'}
          </button>
        </header>

        <section className="page-body">
          <Outlet />
        </section>
      </main>
    </div>
  );
}

export default AppShell;
