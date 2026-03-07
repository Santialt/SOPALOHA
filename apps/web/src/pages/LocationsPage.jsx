import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InlineError from '../components/InlineError';
import InlineSuccess from '../components/InlineSuccess';
import LoadingBlock from '../components/LoadingBlock';
import { useDataLoader } from '../hooks/useDataLoader';
import { api, enums } from '../services/api';

const initialForm = {
  name: '',
  company_name: '',
  city: '',
  status: 'active',
  phone: ''
};

function LocationsPage() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);

  const { load: loadLocations, loading, error, setError } = useDataLoader(async () => {
    const data = await api.getLocations();
    setLocations(data);
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return locations;

    return locations.filter((location) => {
      return [location.name, location.company_name, location.city, location.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [locations, search]);

  const onSubmit = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (editingId) {
        await api.updateLocation(editingId, form);
        setSuccess(`Local #${editingId} actualizado.`);
      } else {
        await api.createLocation(form);
        setSuccess('Local creado.');
      }

      setForm(initialForm);
      setEditingId(null);
      await loadLocations();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (location, event) => {
    event.stopPropagation();
    setSuccess('');
    setEditingId(location.id);
    setForm({
      name: location.name || '',
      company_name: location.company_name || '',
      city: location.city || '',
      status: location.status || 'active',
      phone: location.phone || ''
    });
  };

  const onDelete = async (location, event) => {
    event.stopPropagation();
    const ok = window.confirm(`Eliminar el local "${location.name}"?`);
    if (!ok) return;

    setDeletingId(location.id);
    setError('');
    setSuccess('');

    try {
      await api.deleteLocation(location.id);
      setSuccess(`Local #${location.id} eliminado.`);
      if (editingId === location.id) {
        setEditingId(null);
        setForm(initialForm);
      }
      await loadLocations();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <LoadingBlock label="Cargando locales..." />;

  return (
    <div className="grid-two-columns">
      <section className="section-card">
        <div className="section-head">
          <h2>Listado de locales</h2>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, empresa, ciudad o telefono"
            className="input"
          />
        </div>

        <InlineError message={error} />
        <InlineSuccess message={success} />

        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Empresa</th>
              <th>Ciudad</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((location) => (
              <tr key={location.id} onClick={() => navigate(`/locations/${location.id}`)} className="row-clickable">
                <td>{location.id}</td>
                <td>{location.name}</td>
                <td>{location.company_name || '-'}</td>
                <td>{location.city || '-'}</td>
                <td><span className={`badge ${location.status}`}>{location.status}</span></td>
                <td>
                  <div className="form-actions">
                    <button className="btn-small" onClick={(event) => onEdit(location, event)}>
                      Editar
                    </button>
                    <button
                      className="btn-danger"
                      onClick={(event) => onDelete(location, event)}
                      disabled={deletingId === location.id}
                    >
                      {deletingId === location.id ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="6" className="empty-row">Sin resultados</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="section-card">
        <h2>{editingId ? `Editar local #${editingId}` : 'Crear local'}</h2>

        <form onSubmit={onSubmit} className="form-grid">
          <label>
            Nombre *
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </label>

          <label>
            Empresa
            <input
              className="input"
              value={form.company_name}
              onChange={(event) => setForm({ ...form, company_name: event.target.value })}
            />
          </label>

          <label>
            Ciudad
            <input
              className="input"
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
            />
          </label>

          <label>
            Telefono
            <input
              className="input"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </label>

          <label>
            Estado
            <select
              className="input"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              {enums.locationStatus.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          <div className="form-actions">
            <button className="btn-primary" disabled={saving} type="submit">
              {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(initialForm);
                  setSuccess('');
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

export default LocationsPage;
