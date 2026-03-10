import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import InlineError from '../components/InlineError';
import { useAuth } from '../contexts/AuthContext';

function LoginPage() {
  const location = useLocation();
  const { isAuthenticated, login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    return <Navigate to={location.state?.from?.pathname || '/dashboard'} replace />;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      await login(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-card">
        <div className="sidebar-brand">SOPALOHA</div>
        <div className="sidebar-subtitle">Acceso interno de soporte Aloha POS</div>
        <InlineError message={error} />

        <form onSubmit={onSubmit} className="form-grid">
          <label>
            Email
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
          </label>

          <label>
            Password
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
            />
          </label>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </section>
    </div>
  );
}

export default LoginPage;
