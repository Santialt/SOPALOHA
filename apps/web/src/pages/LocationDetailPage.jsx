import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import InlineError from '../components/InlineError';
import InlineSuccess from '../components/InlineSuccess';
import LoadingBlock from '../components/LoadingBlock';
import { useDataLoader } from '../hooks/useDataLoader';
import { api, enums } from '../services/api';

const defaultLocationForm = {
  name: '',
  company_name: '',
  razon_social: '',
  cuit: '',
  llave_aloha: '',
  version_aloha: '',
  version_modulo_fiscal: '',
  usa_nbo: false,
  network_notes: '',
  address: '',
  city: '',
  province: '',
  phone: '',
  main_contact: '',
  status: 'active',
  notes: ''
};

const defaultDeviceForm = {
  name: '',
  device_role: 'pos',
  ip_address: '',
  teamviewer_id: '',
  windows_version: '',
  ram_gb: '',
  cpu: '',
  disk_type: '',
  notes: ''
};

const suggestedIntegrations = ['mercado_pago', 'bancard', 'pedidos_ya', 'rappi', 'modo'];

function mapLocationToForm(location) {
  return {
    ...defaultLocationForm,
    ...location,
    usa_nbo: Boolean(location.usa_nbo)
  };
}

function mapDeviceToForm(device) {
  return {
    ...defaultDeviceForm,
    name: device.name || '',
    device_role: device.device_role || 'other',
    ip_address: device.ip_address || '',
    teamviewer_id: device.teamviewer_id || '',
    windows_version: device.windows_version || '',
    ram_gb: device.ram_gb ?? '',
    cpu: device.cpu || '',
    disk_type: device.disk_type || '',
    notes: device.notes || ''
  };
}

function LocationDetailPage() {
  const { id } = useParams();
  const numericLocationId = Number(id);

  const [location, setLocation] = useState(null);
  const [locationForm, setLocationForm] = useState(defaultLocationForm);
  const [savingLocation, setSavingLocation] = useState(false);
  const [devices, setDevices] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [customIntegration, setCustomIntegration] = useState('');
  const [savingIntegrations, setSavingIntegrations] = useState(false);

  const [deviceForm, setDeviceForm] = useState(defaultDeviceForm);
  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [savingDevice, setSavingDevice] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [deletingDeviceId, setDeletingDeviceId] = useState(null);
  const [deletingNoteId, setDeletingNoteId] = useState(null);
  const [success, setSuccess] = useState('');

  const { load, loading, error, setError } = useDataLoader(async () => {
    const [locationData, allDevices, allIncidents, allNotes, allTasks, locationIntegrations] =
      await Promise.all([
        api.getLocationById(id),
        api.getDevices(),
        api.getIncidents(),
        api.getLocationNotes(),
        api.getWeeklyTasks(),
        api.getLocationIntegrations(id)
      ]);

    setLocation(locationData);
    setLocationForm(mapLocationToForm(locationData));
    setDevices(allDevices.filter((item) => item.location_id === numericLocationId));
    setIncidents(allIncidents.filter((item) => item.location_id === numericLocationId));
    setNotes(allNotes.filter((item) => item.location_id === numericLocationId));
    setTasks(allTasks.filter((item) => item.location_id === numericLocationId));
    setIntegrations(locationIntegrations.map((item) => item.integration_name));
  }, [id, numericLocationId]);

  const lastIncidents = useMemo(() => incidents.slice(0, 8), [incidents]);

  const onSaveLocation = async (event) => {
    event.preventDefault();
    setSavingLocation(true);
    setError('');
    setSuccess('');

    try {
      const updated = await api.updateLocation(id, locationForm);
      setLocation(updated);
      setLocationForm(mapLocationToForm(updated));
      setSuccess('Ficha tecnica actualizada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingLocation(false);
    }
  };

  const onSaveIntegrations = async () => {
    setSavingIntegrations(true);
    setError('');
    setSuccess('');

    try {
      const updated = await api.replaceLocationIntegrations(id, integrations);
      setIntegrations(updated.map((item) => item.integration_name));
      setSuccess('Integraciones actualizadas.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingIntegrations(false);
    }
  };

  const onAddIntegration = () => {
    const value = customIntegration.trim();
    if (!value) return;
    if (integrations.includes(value)) return;
    setIntegrations([...integrations, value]);
    setCustomIntegration('');
  };

  const onToggleSuggestedIntegration = (integrationName) => {
    if (integrations.includes(integrationName)) {
      setIntegrations(integrations.filter((item) => item !== integrationName));
    } else {
      setIntegrations([...integrations, integrationName]);
    }
  };

  const onRemoveIntegration = (integrationName) => {
    setIntegrations(integrations.filter((item) => item !== integrationName));
  };

  const onCreateOrUpdateDevice = async (event) => {
    event.preventDefault();
    setSavingDevice(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        location_id: numericLocationId,
        ...deviceForm
      };

      if (editingDeviceId) {
        const current = devices.find((item) => item.id === editingDeviceId);
        await api.updateDevice(editingDeviceId, { ...current, ...payload });
        setSuccess(`Dispositivo #${editingDeviceId} actualizado.`);
      } else {
        await api.createDevice(payload);
        setSuccess('Dispositivo agregado.');
      }

      setDeviceForm(defaultDeviceForm);
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
    setDeviceForm(mapDeviceToForm(device));
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
        setDeviceForm(defaultDeviceForm);
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
      await api.createLocationNote({ location_id: numericLocationId, note: noteText });
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
        <h2>Ficha tecnica: {location.name}</h2>
        <form onSubmit={onSaveLocation} className="form-grid form-grid-3">
          <label>
            Nombre *
            <input
              className="input"
              value={locationForm.name}
              onChange={(event) => setLocationForm({ ...locationForm, name: event.target.value })}
              required
            />
          </label>
          <label>
            Empresa
            <input
              className="input"
              value={locationForm.company_name || ''}
              onChange={(event) => setLocationForm({ ...locationForm, company_name: event.target.value })}
            />
          </label>
          <label>
            Razon social
            <input
              className="input"
              value={locationForm.razon_social || ''}
              onChange={(event) => setLocationForm({ ...locationForm, razon_social: event.target.value })}
            />
          </label>
          <label>
            CUIT
            <input
              className="input"
              value={locationForm.cuit || ''}
              onChange={(event) => setLocationForm({ ...locationForm, cuit: event.target.value })}
            />
          </label>
          <label>
            Llave Aloha
            <input
              className="input"
              value={locationForm.llave_aloha || ''}
              onChange={(event) => setLocationForm({ ...locationForm, llave_aloha: event.target.value })}
            />
          </label>
          <label>
            Version Aloha
            <input
              className="input"
              value={locationForm.version_aloha || ''}
              onChange={(event) => setLocationForm({ ...locationForm, version_aloha: event.target.value })}
            />
          </label>
          <label>
            Version modulo fiscal
            <input
              className="input"
              value={locationForm.version_modulo_fiscal || ''}
              onChange={(event) =>
                setLocationForm({ ...locationForm, version_modulo_fiscal: event.target.value })
              }
            />
          </label>
          <label>
            Ciudad
            <input
              className="input"
              value={locationForm.city || ''}
              onChange={(event) => setLocationForm({ ...locationForm, city: event.target.value })}
            />
          </label>
          <label>
            Provincia
            <input
              className="input"
              value={locationForm.province || ''}
              onChange={(event) => setLocationForm({ ...locationForm, province: event.target.value })}
            />
          </label>
          <label>
            Telefono
            <input
              className="input"
              value={locationForm.phone || ''}
              onChange={(event) => setLocationForm({ ...locationForm, phone: event.target.value })}
            />
          </label>
          <label>
            Contacto principal
            <input
              className="input"
              value={locationForm.main_contact || ''}
              onChange={(event) => setLocationForm({ ...locationForm, main_contact: event.target.value })}
            />
          </label>
          <label>
            Estado
            <select
              className="input"
              value={locationForm.status || 'active'}
              onChange={(event) => setLocationForm({ ...locationForm, status: event.target.value })}
            >
              {enums.locationStatus.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Usa NBO</span>
            <input
              type="checkbox"
              checked={Boolean(locationForm.usa_nbo)}
              onChange={(event) => setLocationForm({ ...locationForm, usa_nbo: event.target.checked })}
            />
          </label>
          <label className="full-row">
            Notas de red
            <textarea
              className="input"
              rows="3"
              value={locationForm.network_notes || ''}
              onChange={(event) => setLocationForm({ ...locationForm, network_notes: event.target.value })}
            />
          </label>
          <label className="full-row">
            Notas generales
            <textarea
              className="input"
              rows="2"
              value={locationForm.notes || ''}
              onChange={(event) => setLocationForm({ ...locationForm, notes: event.target.value })}
            />
          </label>
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={savingLocation}>
              {savingLocation ? 'Guardando...' : 'Guardar ficha tecnica'}
            </button>
          </div>
        </form>
      </section>

      <section className="section-card">
        <h3>Integraciones ({integrations.length})</h3>
        <div className="quick-links">
          {suggestedIntegrations.map((integrationName) => (
            <button
              type="button"
              key={integrationName}
              className={integrations.includes(integrationName) ? 'btn-primary' : 'btn-secondary'}
              onClick={() => onToggleSuggestedIntegration(integrationName)}
            >
              {integrationName}
            </button>
          ))}
        </div>

        <div className="inline-form">
          <input
            className="input"
            value={customIntegration}
            onChange={(event) => setCustomIntegration(event.target.value)}
            placeholder="Nueva integracion"
          />
          <button type="button" className="btn-secondary" onClick={onAddIntegration}>
            Agregar
          </button>
          <button type="button" className="btn-primary" onClick={onSaveIntegrations} disabled={savingIntegrations}>
            {savingIntegrations ? 'Guardando...' : 'Guardar'}
          </button>
        </div>

        <div className="chip-list">
          {integrations.map((integrationName) => (
            <span key={integrationName} className="chip">
              {integrationName}
              <button type="button" className="chip-remove" onClick={() => onRemoveIntegration(integrationName)}>
                x
              </button>
            </span>
          ))}
          {integrations.length === 0 && <small>Sin integraciones cargadas.</small>}
        </div>
      </section>

      <section className="section-card">
        <div className="section-head wrap">
          <h3>Dispositivos ({devices.length})</h3>
          <Link to="/incidents" className="btn-link">
            Crear incidente
          </Link>
        </div>
        <table className="table compact">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Rol</th>
              <th>IP</th>
              <th>TeamViewer</th>
              <th>Windows</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id}>
                <td>{device.id}</td>
                <td>{device.name}</td>
                <td>{device.device_role || '-'}</td>
                <td>{device.ip_address || '-'}</td>
                <td>{device.teamviewer_id || '-'}</td>
                <td>{device.windows_version || '-'}</td>
                <td>
                  <div className="form-actions">
                    <button className="btn-small" onClick={() => onEditDevice(device)}>
                      Editar
                    </button>
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
            {devices.length === 0 && (
              <tr>
                <td colSpan="7" className="empty-row">
                  Sin dispositivos
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <form onSubmit={onCreateOrUpdateDevice} className="form-grid form-grid-3">
          <label>
            Nombre *
            <input
              className="input"
              value={deviceForm.name}
              onChange={(event) => setDeviceForm({ ...deviceForm, name: event.target.value })}
              required
            />
          </label>
          <label>
            Rol
            <select
              className="input"
              value={deviceForm.device_role}
              onChange={(event) => setDeviceForm({ ...deviceForm, device_role: event.target.value })}
            >
              {enums.deviceRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label>
            IP
            <input
              className="input"
              value={deviceForm.ip_address}
              onChange={(event) => setDeviceForm({ ...deviceForm, ip_address: event.target.value })}
            />
          </label>
          <label>
            TeamViewer ID
            <input
              className="input"
              value={deviceForm.teamviewer_id}
              onChange={(event) => setDeviceForm({ ...deviceForm, teamviewer_id: event.target.value })}
            />
          </label>
          <label>
            Version Windows
            <input
              className="input"
              value={deviceForm.windows_version}
              onChange={(event) => setDeviceForm({ ...deviceForm, windows_version: event.target.value })}
            />
          </label>
          <label>
            RAM (GB)
            <input
              className="input"
              type="number"
              min="0"
              step="0.5"
              value={deviceForm.ram_gb}
              onChange={(event) => setDeviceForm({ ...deviceForm, ram_gb: event.target.value })}
            />
          </label>
          <label>
            CPU
            <input
              className="input"
              value={deviceForm.cpu}
              onChange={(event) => setDeviceForm({ ...deviceForm, cpu: event.target.value })}
            />
          </label>
          <label>
            Tipo de disco
            <input
              className="input"
              value={deviceForm.disk_type}
              onChange={(event) => setDeviceForm({ ...deviceForm, disk_type: event.target.value })}
            />
          </label>
          <label className="full-row">
            Notas
            <textarea
              className="input"
              rows="2"
              value={deviceForm.notes}
              onChange={(event) => setDeviceForm({ ...deviceForm, notes: event.target.value })}
            />
          </label>
          <div className="form-actions">
            <button className="btn-primary" type="submit" disabled={savingDevice}>
              {savingDevice ? 'Guardando...' : editingDeviceId ? 'Actualizar' : 'Agregar'}
            </button>
            {editingDeviceId && (
              <button
                className="btn-secondary"
                type="button"
                onClick={() => {
                  setEditingDeviceId(null);
                  setDeviceForm(defaultDeviceForm);
                }}
              >
                Cancelar
              </button>
            )}
          </div>
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
            {incidents.length === 0 && (
              <tr>
                <td colSpan="4" className="empty-row">
                  Sin incidentes
                </td>
              </tr>
            )}
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
                <td>
                  <span className={`badge ${task.priority}`}>{task.priority}</span>
                </td>
                <td>{task.status}</td>
                <td>{task.due_date || '-'}</td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan="5" className="empty-row">
                  Sin tareas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default LocationDetailPage;
