import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import InlineError from '../components/InlineError';
import LoadingBlock from '../components/LoadingBlock';
import { api, enums } from '../services/api';

function LocationDetailPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [location, setLocation] = useState(null);
  const [devices, setDevices] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [deviceForm, setDeviceForm] = useState({ name: '', type: 'pos_terminal' });
  const [noteText, setNoteText] = useState('');
  const [savingDevice, setSavingDevice] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const [locationData, allDevices, allIncidents, allNotes, allTasks] = await Promise.all([
        api.getLocationById(id),
        api.getDevices(),
        api.getIncidents(),
        api.getLocationNotes(),
        api.getWeeklyTasks()
      ]);

      const numericId = Number(id);
      setLocation(locationData);
      setDevices(allDevices.filter((item) => item.location_id === numericId));
      setIncidents(allIncidents.filter((item) => item.location_id === numericId));
      setNotes(allNotes.filter((item) => item.location_id === numericId));
      setTasks(allTasks.filter((item) => item.location_id === numericId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const lastIncidents = useMemo(() => incidents.slice(0, 8), [incidents]);

  const onCreateDevice = async (event) => {
    event.preventDefault();
    setSavingDevice(true);
    setError('');

    try {
      await api.createDevice({
        location_id: Number(id),
        name: deviceForm.name,
        type: deviceForm.type
      });
      setDeviceForm({ name: '', type: 'pos_terminal' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingDevice(false);
    }
  };

  const onCreateNote = async (event) => {
    event.preventDefault();
    setSavingNote(true);
    setError('');

    try {
      await api.createLocationNote({ location_id: Number(id), note: noteText });
      setNoteText('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) return <LoadingBlock label="Cargando detalle de local..." />;

  if (!location) {
    return <InlineError message="No se encontro el local." />;
  }

  return (
    <div className="detail-grid">
      <InlineError message={error} />

      <section className="section-card full-width">
        <h2>{location.name}</h2>
        <div className="key-value-grid">
          <div><strong>ID:</strong> {location.id}</div>
          <div><strong>Empresa:</strong> {location.company_name || '-'}</div>
          <div><strong>Ciudad:</strong> {location.city || '-'}</div>
          <div><strong>Provincia:</strong> {location.province || '-'}</div>
          <div><strong>Telefono:</strong> {location.phone || '-'}</div>
          <div><strong>Contacto:</strong> {location.main_contact || '-'}</div>
          <div><strong>Estado:</strong> {location.status}</div>
        </div>
      </section>

      <section className="section-card">
        <div className="section-head">
          <h3>Dispositivos ({devices.length})</h3>
        </div>
        <table className="table compact">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id}>
                <td>{device.id}</td>
                <td>{device.name}</td>
                <td>{device.type}</td>
                <td>{device.ip_address || '-'}</td>
              </tr>
            ))}
            {devices.length === 0 && <tr><td colSpan="4" className="empty-row">Sin dispositivos</td></tr>}
          </tbody>
        </table>

        <form onSubmit={onCreateDevice} className="inline-form">
          <input
            className="input"
            value={deviceForm.name}
            onChange={(event) => setDeviceForm({ ...deviceForm, name: event.target.value })}
            placeholder="Nombre de dispositivo"
            required
          />
          <select
            className="input"
            value={deviceForm.type}
            onChange={(event) => setDeviceForm({ ...deviceForm, type: event.target.value })}
          >
            {enums.deviceTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <button className="btn-primary" type="submit" disabled={savingDevice}>
            {savingDevice ? 'Guardando...' : 'Agregar'}
          </button>
        </form>
      </section>

      <section className="section-card">
        <h3>Incidentes ({incidents.length})</h3>
        <table className="table compact">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Titulo</th>
              <th>Estado</th>
              <th>Categoria</th>
            </tr>
          </thead>
          <tbody>
            {lastIncidents.map((incident) => (
              <tr key={incident.id}>
                <td>{incident.incident_date}</td>
                <td>{incident.title}</td>
                <td>{incident.status}</td>
                <td>{incident.category}</td>
              </tr>
            ))}
            {incidents.length === 0 && <tr><td colSpan="4" className="empty-row">Sin incidentes</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="section-card">
        <h3>Notas Tecnicas ({notes.length})</h3>
        <ul className="notes-list">
          {notes.map((note) => (
            <li key={note.id}>
              <div>{note.note}</div>
              <small>{note.created_at}</small>
            </li>
          ))}
          {notes.length === 0 && <li className="empty-row">Sin notas</li>}
        </ul>

        <form onSubmit={onCreateNote} className="inline-form">
          <input
            className="input"
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Agregar nota tecnica"
            required
          />
          <button className="btn-primary" type="submit" disabled={savingNote}>
            {savingNote ? 'Guardando...' : 'Agregar Nota'}
          </button>
        </form>
      </section>

      <section className="section-card full-width">
        <h3>Tareas Semanales ({tasks.length})</h3>
        <table className="table compact">
          <thead>
            <tr>
              <th>ID</th>
              <th>Titulo</th>
              <th>Prioridad</th>
              <th>Estado</th>
              <th>Vencimiento</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>{task.id}</td>
                <td>{task.title}</td>
                <td><span className={`badge ${task.priority}`}>{task.priority}</span></td>
                <td>{task.status}</td>
                <td>{task.due_date || '-'}</td>
              </tr>
            ))}
            {tasks.length === 0 && <tr><td colSpan="5" className="empty-row">Sin tareas</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default LocationDetailPage;
