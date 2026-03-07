import { useEffect, useMemo, useState } from 'react';
import InlineError from '../components/InlineError';
import LoadingBlock from '../components/LoadingBlock';
import { api, enums } from '../services/api';

function IncidentsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [locations, setLocations] = useState([]);
  const [devices, setDevices] = useState([]);
  const [incidents, setIncidents] = useState([]);

  const [filters, setFilters] = useState({ status: '', category: '' });
  const [form, setForm] = useState({
    location_id: '',
    device_id: '',
    incident_date: new Date().toISOString().slice(0, 10),
    title: '',
    description: '',
    category: 'other',
    status: 'open'
  });

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const [incidentsData, locationsData, devicesData] = await Promise.all([
        api.getIncidents(),
        api.getLocations(),
        api.getDevices()
      ]);
      setIncidents(incidentsData);
      setLocations(locationsData);
      setDevices(devicesData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const statusOk = !filters.status || incident.status === filters.status;
      const categoryOk = !filters.category || incident.category === filters.category;
      return statusOk && categoryOk;
    });
  }, [incidents, filters]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      await api.createIncident({
        ...form,
        location_id: Number(form.location_id),
        device_id: form.device_id ? Number(form.device_id) : null
      });

      setForm({
        location_id: '',
        device_id: '',
        incident_date: new Date().toISOString().slice(0, 10),
        title: '',
        description: '',
        category: 'other',
        status: 'open'
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingBlock label="Cargando incidentes..." />;

  return (
    <div className="grid-two-columns">
      <section className="section-card">
        <h2>Alta rapida de incidente</h2>
        <InlineError message={error} />

        <form onSubmit={onSubmit} className="form-grid">
          <label>
            Local *
            <select
              className="input"
              value={form.location_id}
              onChange={(event) => setForm({ ...form, location_id: event.target.value })}
              required
            >
              <option value="">Seleccionar</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </label>

          <label>
            Dispositivo
            <select
              className="input"
              value={form.device_id}
              onChange={(event) => setForm({ ...form, device_id: event.target.value })}
            >
              <option value="">Sin dispositivo</option>
              {devices
                .filter((device) => !form.location_id || device.location_id === Number(form.location_id))
                .map((device) => (
                  <option key={device.id} value={device.id}>{device.name}</option>
                ))}
            </select>
          </label>

          <label>
            Fecha *
            <input
              className="input"
              type="date"
              value={form.incident_date}
              onChange={(event) => setForm({ ...form, incident_date: event.target.value })}
              required
            />
          </label>

          <label>
            Titulo *
            <input
              className="input"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              required
            />
          </label>

          <label>
            Categoria
            <select
              className="input"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
              {enums.incidentCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>

          <label>
            Estado
            <select
              className="input"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              {enums.incidentStatus.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          <label className="full-row">
            Descripcion *
            <textarea
              className="input"
              rows="4"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              required
            />
          </label>

          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Crear incidente'}
          </button>
        </form>
      </section>

      <section className="section-card">
        <div className="section-head wrap">
          <h2>Listado de incidentes</h2>
          <div className="filter-row">
            <select
              className="input"
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            >
              <option value="">Todos los estados</option>
              {enums.incidentStatus.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select
              className="input"
              value={filters.category}
              onChange={(event) => setFilters({ ...filters, category: event.target.value })}
            >
              <option value="">Todas las categorias</option>
              {enums.incidentCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>

        <table className="table compact">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Local</th>
              <th>Titulo</th>
              <th>Categoria</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredIncidents.map((incident) => {
              const location = locations.find((item) => item.id === incident.location_id);
              return (
                <tr key={incident.id}>
                  <td>{incident.incident_date}</td>
                  <td>{location?.name || `#${incident.location_id}`}</td>
                  <td>{incident.title}</td>
                  <td>{incident.category}</td>
                  <td><span className={`badge ${incident.status}`}>{incident.status}</span></td>
                </tr>
              );
            })}
            {filteredIncidents.length === 0 && (
              <tr>
                <td colSpan="5" className="empty-row">Sin incidentes</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default IncidentsPage;
