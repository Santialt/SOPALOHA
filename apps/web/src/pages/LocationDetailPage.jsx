import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import InlineError from '../components/InlineError';
import InlineSuccess from '../components/InlineSuccess';
import LoadingBlock from '../components/LoadingBlock';
import { useDataLoader } from '../hooks/useDataLoader';
import { api, enums } from '../services/api';

function LocationDetailPage() {
  const { id } = useParams();
  const [location, setLocation] = useState(null);
  const [devices, setDevices] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [deviceForm, setDeviceForm] = useState({ name: '', type: 'pos_terminal' });
  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [savingDevice, setSavingDevice] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [deletingDeviceId, setDeletingDeviceId] = useState(null);
  const [deletingNoteId, setDeletingNoteId] = useState(null);
  const [success, setSuccess] = useState('');

  const { load, loading, error, setError } = useDataLoader(async () => {
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
  }, [id]);

  const lastIncidents = useMemo(() => incidents.slice(0, 8), [incidents]);

  const onCreateOrUpdateDevice = async (event) => {
    event.preventDefault();
    setSavingDevice(true);
    setError('');
    setSuccess('');

    try {
      if (editingDeviceId) {
        const current = devices.find((item) => item.id === editingDeviceId);
        await api.updateDevice(editingDeviceId, {
          ...current,
          name: deviceForm.name,
          type: deviceForm.type,
          location_id: Number(id)
        });
        setSuccess(`Dispositivo #${editingDeviceId} actualizado.`);
      } else {
        await api.createDevice({
          location_id: Number(id),
          name: deviceForm.name,
          type: deviceForm.type
        });
        setSuccess('Dispositivo agregado.');
      }

      setDeviceForm({ name: '', type: 'pos_terminal' });
      setEditingDeviceId(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingDevice(false);
    }
  };

  const onEditDevice = (device) => {
    setSuccess('');
    setEditingDeviceId(device.id);
    setDeviceForm({
      name: device.name || '',
      type: device.type || 'pos_terminal'
    });
  };

  const onDeleteDevice = async (device) => {
    const ok = window.confirm(`Eliminar el dispositivo "${device.name}"?`);
    if (!ok) return;

    setDeletingDeviceId(device.id);
    setError('');
    setSuccess('');

    try {
      await api.deleteDevice(device.id);
      setSuccess(`Dispositivo #${device.id} eliminado.`);
      if (editingDeviceId === device.id) {
        setEditingDeviceId(null);
        setDeviceForm({ name: '', type: 'pos_terminal' });
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingDeviceId(null);
    }
  };

  const onCreateNote = async (event) => {
    event.preventDefault();
    setSavingNote(true);
    setError('');
    setSuccess('');

    try {
      await api.createLocationNote({ location_id: Number(id), note: noteText });
      setNoteText('');
      setSuccess('Nota creada.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingNote(false);
    }
  };

  const onDeleteNote = async (note) => {
    const ok = window.confirm('Eliminar esta nota tecnica?');
    if (!ok) return;

    setDeletingNoteId(note.id);
    setError('');
    setSuccess('');

    try {
      await api.deleteLocationNote(note.id);
      setSuccess('Nota eliminada.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingNoteId(null);
    }
  };

  if (loading) return <LoadingBlock label="Cargando detalle de local..." />;

  if (!location) {
    return <InlineError message="No se encontro el local." />;
  }

  return (
    <div className="detail-grid">
      <InlineError message={error} />
      <InlineSuccess message={success} />

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
        <div className="section-head wrap">
          <h3>Dispositivos ({devices.length})</h3>
          <Link to="/incidents" className="btn-link">Crear incidente</Link>
        </div>
        <table className="table compact">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>IP</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id}>
                <td>{device.id}</td>
                <td>{device.name}</td>
                <td>{device.type}</td>
                <td>{device.ip_address || '-'}</td>
                <td>
                  <div className="form-actions">
                    <button className="btn-small" onClick={() => onEditDevice(device)}>Editar</button>
                    <button
                      className="btn-danger"
                      onClick={() => onDeleteDevice(device)}
                      disabled={deletingDeviceId === device.id}
                    >
                      {deletingDeviceId === device.id ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {devices.length === 0 && <tr><td colSpan="5" className="empty-row">Sin dispositivos</td></tr>}
          </tbody>
        </table>

        <form onSubmit={onCreateOrUpdateDevice} className="inline-form">
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
            {savingDevice ? 'Guardando...' : editingDeviceId ? 'Actualizar' : 'Agregar'}
          </button>
          {editingDeviceId && (
            <button
              className="btn-secondary"
              type="button"
              onClick={() => {
                setEditingDeviceId(null);
                setDeviceForm({ name: '', type: 'pos_terminal' });
              }}
            >
              Cancelar
            </button>
          )}
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
              <div className="form-actions">
                <small>{note.created_at}</small>
                <button
                  className="btn-danger"
                  onClick={() => onDeleteNote(note)}
                  disabled={deletingNoteId === note.id}
                >
                  {deletingNoteId === note.id ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
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
