import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { applyTheme, getPreferredTheme } from '../theme';
import LocationQuickSearch from './LocationQuickSearch';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/locations', label: 'Locales' },
  { to: '/incidents', label: 'Casos TeamViewer' },
  { to: '/tasks', label: 'Tareas' },
  { to: '/on-call', label: 'Guardias' },
  { to: '/teamviewer-explorer', label: 'TeamViewer Explorer' },
  { to: '/teamviewer-import', label: 'TeamViewer Import' },
  { to: '/users', label: 'Usuarios', adminOnly: true }
];

const pageTitles = {
  '/dashboard': 'Dashboard Operativo',
  '/locations': 'Gestion de locales',
  '/incidents': 'Casos TeamViewer',
  '/tasks': 'Tareas',
  '/on-call': 'Guardias',
  '/teamviewer-explorer': 'TeamViewer Explorer',
  '/teamviewer-import': 'TeamViewer Import',
  '/users': 'Usuarios'
};

function resolveTitle(pathname) {
  if (pathname.startsWith('/locations/')) {
    return 'Detalle de local';
  }

  return pageTitles[pathname] || 'Panel SOPALOHA';
}

function AppShell() {
  const { pathname } = useLocation();
  const { user, isAdmin, logout } = useAuth();
  const [theme, setTheme] = useState(() => getPreferredTheme());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const headerTitle = useMemo(() => resolveTitle(pathname), [pathname]);
  const visibleNavItems = useMemo(
    () => navItems.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin]
  );

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const onToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(applyTheme(nextTheme));
  };

  const onLogout = async () => {
    await logout();
  };

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} id="primary-sidebar">
        <div className="sidebar-brand">SOPALOHA</div>
        <div className="sidebar-subtitle">OPS Console / Aloha POS</div>
        <nav className="sidebar-nav" aria-label="Navegacion principal">
          {visibleNavItems.map((item) => (
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

      <main className="main-content" id="main-content">
        <header className="main-header">
          <div className="main-header-inner">
            <div className="header-title-block">
              <div className="header-top-row">
                <button
                  type="button"
                  className="sidebar-toggle"
                  onClick={() => setSidebarOpen((current) => !current)}
                  aria-expanded={sidebarOpen}
                  aria-controls="primary-sidebar"
                  aria-label="Abrir menu de navegacion"
                >
                  Menu
                </button>
                <div>
                  <h1>{headerTitle}</h1>
                  <div className="header-subtitle">
                    Mesa interna de soporte POS / Aloha
                    {user ? ` - ${user.name} (${user.role})` : ''}
                  </div>
                </div>
              </div>
            </div>

            <div className="main-header-search">
              <LocationQuickSearch />
            </div>

            <div className="main-header-actions">
              <div className="form-actions">
                <button type="button" className="theme-toggle" onClick={onToggleTheme}>
                  Tema: {theme === 'dark' ? 'Oscuro' : 'Claro'}
                </button>
                <button type="button" className="btn-secondary" onClick={onLogout}>
                  Cerrar sesion
                </button>
              </div>
            </div>
          </div>
        </header>

        <section className="page-body">
          <Outlet />
        </section>
      </main>

      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Cerrar menu de navegacion"
        />
      )}
    </div>
  );
}

export default AppShell;
