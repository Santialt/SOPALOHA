import { NavLink, Outlet, useLocation } from 'react-router-dom';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/locations', label: 'Locales' },
  { to: '/incidents', label: 'Incidentes' },
  { to: '/weekly-tasks', label: 'Tareas Semanales' },
  { to: '/location-notes', label: 'Notas Tecnicas' },
  { to: '/teamviewer-explorer', label: 'TeamViewer Explorer' },
  { to: '/teamviewer-import', label: 'TeamViewer Import' }
];

const pageTitles = {
  '/dashboard': 'Dashboard Operativo',
  '/locations': 'Gestion de Locales',
  '/incidents': 'Incidentes',
  '/weekly-tasks': 'Tareas Semanales',
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">SOPALOHA</div>
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
          <h1>{resolveTitle(pathname)}</h1>
          <div className="header-subtitle">Mesa interna de soporte POS / Aloha</div>
        </header>

        <section className="page-body">
          <Outlet />
        </section>
      </main>
    </div>
  );
}

export default AppShell;
