import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import InlineError from '../components/InlineError';
import InlineSuccess from '../components/InlineSuccess';
import LoadingBlock from '../components/LoadingBlock';
import TeamViewerImportedCasesPage from './TeamViewerImportedCasesPage';
import { useDataLoader } from '../hooks/useDataLoader';
import { api } from '../services/api';

function nowForDatetimeInput() {
  const date = new Date();
  date.setSeconds(0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function buildInitialForm(prefillLocationId, prefillDeviceId) {
  return {
    location_id: prefillLocationId || '',
    device_id: prefillDeviceId || '',
    incident_date: nowForDatetimeInput(),
    problem: '',
    solution: '',
    time_spent_minutes: ''
  };
}

function IncidentsPage() {
  const [searchParams] = useSearchParams();
  const prefillLocationId = Number(searchParams.get('location_id')) || '';
  const prefillDeviceId = Number(searchParams.get('device_id')) || '';

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [locations, setLocations] = useState([]);
  const [devices, setDevices] = useState([]);
  const [form, setForm] = useState(buildInitialForm(prefillLocationId, prefillDeviceId));

  const { loading, error, setError } = useDataLoader(async () => {
    const [locationsData, devicesData] = await Promise.all([api.getLocations(), api.getDevices()]);
    setLocations(locationsData);
    setDevices(devicesData);
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.createIncident({
        location_id: Number(form.location_id),
        device_id: form.device_id ? Number(form.device_id) : null,
        incident_date: form.incident_date,
        title: form.problem,
        description: form.problem,
        solution: form.solution,
        category: 'other',
        status: 'open',
        time_spent_minutes: Number(form.time_spent_minutes || 0)
      });

      setForm(buildInitialForm(prefillLocationId, prefillDeviceId));
      setSuccess('Incidente creado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingBlock label="Cargando incidentes..." />;

  return (
    <div>
      <section className="section-card">
        <h2>Registro operativo de incidente</h2>
        <InlineError message={error} />
        <InlineSuccess message={success} />

        <form onSubmit={onSubmit} className="form-grid">
          <label>
            Local
            <select
              className="input"
              value={form.location_id}
              onChange={(event) => setForm({ ...form, location_id: event.target.value, device_id: '' })}
              required
              disabled={Boolean(prefillLocationId)}
            >
              <option value="">Seleccionar</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Dispositivo
            <select
              className="input"
              value={form.device_id}
              onChange={(event) => setForm({ ...form, device_id: event.target.value })}
              disabled={Boolean(prefillDeviceId)}
            >
              <option value="">Sin dispositivo</option>
              {devices
                .filter((device) => !form.location_id || device.location_id === Number(form.location_id))
                .map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
            </select>
          </label>

          <label>
            Fecha y hora
            <input
              className="input"
              type="datetime-local"
              value={form.incident_date}
              onChange={(event) => setForm({ ...form, incident_date: event.target.value })}
              required
            />
          </label>

          <label className="full-row">
            Problema *
            <textarea
              className="input"
              rows="4"
              value={form.problem}
              onChange={(event) => setForm({ ...form, problem: event.target.value })}
              required
            />
          </label>

          <label className="full-row">
            Solucion *
            <textarea
              className="input"
              rows="3"
              value={form.solution}
              onChange={(event) => setForm({ ...form, solution: event.target.value })}
              required
            />
          </label>

          <label>
            Tiempo (minutos) *
            <input
              className="input"
              type="number"
              min="0"
              value={form.time_spent_minutes}
              onChange={(event) => setForm({ ...form, time_spent_minutes: event.target.value })}
              required
            />
          </label>

          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Crear incidente'}
          </button>
        </form>
      </section>

      <TeamViewerImportedCasesPage />
    </div>
  );
}

export default IncidentsPage;
