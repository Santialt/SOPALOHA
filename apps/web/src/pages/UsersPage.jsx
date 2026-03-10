import { useState } from 'react';
import InlineError from '../components/InlineError';
import InlineSuccess from '../components/InlineSuccess';
import LoadingBlock from '../components/LoadingBlock';
import { useDataLoader } from '../hooks/useDataLoader';
import { api } from '../services/api';

function emptyForm() {
  return {
    name: '',
    email: '',
    password: '',
    role: 'tech',
    active: true
  };
}

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [editingUserId, setEditingUserId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [togglingUserId, setTogglingUserId] = useState(null);

  const { load, loading, error, setError } = useDataLoader(async () => {
    const usersData = await api.getUsers();
    setUsers(usersData);
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        ...form,
        active: Boolean(form.active)
      };

      if (!payload.password) {
        delete payload.password;
      }

      if (editingUserId) {
        await api.updateUser(editingUserId, payload);
        setSuccess(`Usuario #${editingUserId} actualizado.`);
      } else {
        await api.createUser(payload);
        setSuccess('Usuario creado.');
      }

      setEditingUserId(null);
      setForm(emptyForm());
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (user) => {
    setEditingUserId(user.id);
    setError('');
    setSuccess('');
    setForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'tech',
      active: Boolean(user.active)
    });
  };

  const onToggleActive = async (user) => {
    setTogglingUserId(user.id);
    setError('');
    setSuccess('');

    try {
      await api.updateUserActive(user.id, !user.active);
      setSuccess(`Usuario ${!user.active ? 'activado' : 'desactivado'}.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setTogglingUserId(null);
    }
  };

  const onCancel = () => {
    setEditingUserId(null);
    setForm(emptyForm());
  };

  if (loading) return <LoadingBlock label="Cargando usuarios..." />;

  return (
    <div className="grid-two-columns">
      <section className="section-card">
        <h2>{editingUserId ? `Editar usuario #${editingUserId}` : 'Crear usuario'}</h2>
        <InlineError message={error} />
        <InlineSuccess message={success} />

        <form onSubmit={onSubmit} className="form-grid">
          <label>
            Nombre
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </label>

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
            Password {editingUserId ? '(dejar vacio para no cambiar)' : ''}
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required={!editingUserId}
            />
          </label>

          <label>
            Rol
            <select
              className="input"
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
            >
              <option value="tech">tech</option>
              <option value="admin">admin</option>
            </select>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm({ ...form, active: event.target.checked })}
            />
            Activo
          </label>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editingUserId ? 'Guardar cambios' : 'Crear usuario'}
            </button>
            {editingUserId && (
              <button type="button" className="btn-secondary" onClick={onCancel}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="section-card">
        <div className="section-head">
          <h2>Usuarios</h2>
          <small>{users.length} cargados</small>
        </div>

        <table className="table compact">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.active ? 'Activo' : 'Inactivo'}</td>
                <td>
                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={() => onEdit(user)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className={user.active ? 'btn-danger' : 'btn-primary'}
                      onClick={() => onToggleActive(user)}
                      disabled={togglingUserId === user.id}
                    >
                      {togglingUserId === user.id ? 'Procesando...' : user.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan="6" className="empty-row">Sin usuarios.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default UsersPage;
