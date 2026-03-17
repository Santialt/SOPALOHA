import { useRef, useState } from 'react';
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
  address: '',
  city: '',
  phone: '',
  cantidad_licencias_aloha: '',
  tiene_kitchen: false,
  usa_insight_pulse: false,
  cmc: '',
  status: 'abierto',
  fecha_apertura: '',
  fecha_cierre: '',
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

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-AR');
}

function resolveTeamviewerCaseTechnician(row) {
  if (row.technician_display_name) return row.technician_display_name;
  if (row.raw_payload_json) {
    try {
      const parsed = JSON.parse(row.raw_payload_json);
      const name = String(parsed?.username || parsed?.USER || '').trim();
      if (name) return name;
    } catch (error) {
      // ignore payload parsing errors in UI fallback
    }
  }
  if (row.technician_username) return row.technician_username;
  return '-';
}

function mapLocationToForm(location) {
  return {
    ...defaultLocationForm,
    name: location.name || '',
    company_name: location.company_name || '',
    razon_social: location.razon_social || '',
    cuit: location.cuit || '',
    llave_aloha: location.llave_aloha || '',
    version_aloha: location.version_aloha || '',
    version_modulo_fiscal: location.version_modulo_fiscal || '',
    address: location.address || '',
    city: location.city || '',
    phone: location.phone || '',
    cmc: location.cmc || '',
    notes: location.notes || '',
    status: location.status || 'abierto',
    usa_nbo: Boolean(location.usa_nbo),
    tiene_kitchen: Boolean(location.tiene_kitchen),
    usa_insight_pulse: Boolean(location.usa_insight_pulse),
    cantidad_licencias_aloha: location.cantidad_licencias_aloha ?? '',
    fecha_apertura: location.fecha_apertura || '',
    fecha_cierre: location.fecha_cierre || ''
  };
}

function buildDevicePayload(locationId, form) {
  return {
    location_id: locationId,
    name: form.name,
    device_role: form.device_role,
    ip_address: form.ip_address,
    teamviewer_id: form.teamviewer_id,
    windows_version: form.windows_version,
    ram_gb: form.ram_gb,
    cpu: form.cpu,
    disk_type: form.disk_type,
    notes: form.notes
  };
}

function setLocationStatus(setter, status) {
  setter((current) => ({
    ...current,
    status,
    fecha_cierre: status === 'cerrado' ? current.fecha_cierre : ''
  }));
}

function setBooleanSelect(setter, field, value) {
  setter((current) => ({
    ...current,
    [field]: value === 'si'
  }));
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
  const [teamviewerCases, setTeamviewerCases] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [customIntegration, setCustomIntegration] = useState('');
  const [savingIntegrations, setSavingIntegrations] = useState(false);

  const [deviceForm, setDeviceForm] = useState(defaultDeviceForm);
  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [savingDevice, setSavingDevice] = useState(false);
  const [deletingDeviceId, setDeletingDeviceId] = useState(null);
  const [runningActionKey, setRunningActionKey] = useState('');
  const [success, setSuccess] = useState('');
  const teamviewerOpenLockRef = useRef(new Map());

  const { load, loading, error, setError } = useDataLoader(async () => {
    const [
      locationData,
      locationDevices,
      locationTeamviewerCases,
      locationTasks,
      locationIntegrations
    ] =
      await Promise.all([
        api.getLocationById(id),
        api.getLocationDevices(id),
        api.getTeamviewerImportedCases({ location_id: id }),
        api.getLocationTasks(id, { limit: 20 }),
        api.getLocationIntegrations(id)
      ]);

    setLocation(locationData);
    setLocationForm(mapLocationToForm(locationData));
    setDevices(locationDevices);
    setTeamviewerCases(locationTeamviewerCases);
    setTasks(locationTasks);
    setIntegrations(locationIntegrations.map((item) => item.integration_name));
  }, [id, numericLocationId]);

  const onSaveLocation = async (event) => {
    event.preventDefault();
    setSavingLocation(true);
    setError('');
    setSuccess('');

    try {
      const updated = await api.updateLocation(id, mapLocationToForm(locationForm));
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
      const payload = buildDevicePayload(numericLocationId, deviceForm);

      if (editingDeviceId) {
        await api.updateDevice(editingDeviceId, payload);
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

  const copyToClipboard = async (value) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  };

  const onCopyTeamviewerId = async (device) => {
    if (!device.teamviewer_id) {
      setError('El dispositivo no tiene TeamViewer ID.');
      return;
    }

    setError('');
    setSuccess('');

    try {
      await copyToClipboard(device.teamviewer_id);
      setSuccess(`TeamViewer ID copiado: ${device.teamviewer_id}`);
    } catch (err) {
      setError('No se pudo copiar el TeamViewer ID.');
    }
  };

  const onOpenTeamviewer = async (device) => {
    if (!device.teamviewer_id) {
      setError('El dispositivo no tiene TeamViewer ID.');
      return;
    }

    const now = Date.now();
    const lastOpenAt = teamviewerOpenLockRef.current.get(device.id) || 0;
    if (now - lastOpenAt < 3000) {
      setError('');
      setSuccess('Apertura ya solicitada hace unos segundos. Espera un momento.');
      return;
    }

    teamviewerOpenLockRef.current.set(device.id, now);
    const actionKey = `tv-${device.id}`;
    setRunningActionKey(actionKey);
    setError('');
    setSuccess('');

    try {
      const result = await api.openTeamviewer(device.teamviewer_id);
      if (result.skipped) {
        setSuccess('Apertura omitida para evitar doble ejecucion.');
      } else {
        setSuccess(`TeamViewer lanzado por backend (${result.method}).`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRunningActionKey('');
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
            CUIT
            <input
              className="input"
              value={locationForm.cuit || ''}
              onChange={(event) => setLocationForm({ ...locationForm, cuit: event.target.value })}
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
            Ciudad
            <input
              className="input"
              value={locationForm.city || ''}
              onChange={(event) => setLocationForm({ ...locationForm, city: event.target.value })}
            />
          </label>
          <label>
            Direccion
            <input
              className="input"
              value={locationForm.address || ''}
              onChange={(event) => setLocationForm({ ...locationForm, address: event.target.value })}
            />
          </label>
          <label>
            Telefono de contacto
            <input
              className="input"
              value={locationForm.phone || ''}
              onChange={(event) => setLocationForm({ ...locationForm, phone: event.target.value })}
            />
          </label>
          <label>
            Key Aloha
            <input
              className="input"
              value={locationForm.llave_aloha || ''}
              onChange={(event) => setLocationForm({ ...locationForm, llave_aloha: event.target.value })}
            />
          </label>
          <label>
            Cantidad de licencias Aloha
            <input
              type="number"
              min="0"
              step="1"
              className="input"
              value={locationForm.cantidad_licencias_aloha}
              onChange={(event) =>
                setLocationForm({ ...locationForm, cantidad_licencias_aloha: event.target.value })
              }
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
            Version Fiscal
            <input
              className="input"
              value={locationForm.version_modulo_fiscal || ''}
              onChange={(event) =>
                setLocationForm({ ...locationForm, version_modulo_fiscal: event.target.value })
              }
            />
          </label>
          <label>
            Kitchen
            <select
              className="input"
              value={locationForm.tiene_kitchen ? 'si' : 'no'}
              onChange={(event) => setBooleanSelect(setLocationForm, 'tiene_kitchen', event.target.value)}
            >
              <option value="si">Si</option>
              <option value="no">No</option>
            </select>
          </label>
          <label>
            CMC
            <input
              className="input"
              value={locationForm.cmc || ''}
              onChange={(event) => setLocationForm({ ...locationForm, cmc: event.target.value })}
            />
          </label>
          <label>
            PULSE INSIGHT
            <select
              className="input"
              value={locationForm.usa_insight_pulse ? 'si' : 'no'}
              onChange={(event) =>
                setBooleanSelect(setLocationForm, 'usa_insight_pulse', event.target.value)
              }
            >
              <option value="si">Si</option>
              <option value="no">No</option>
            </select>
          </label>
          <label>
            Estado del local
            <select
              className="input"
              value={locationForm.status || 'abierto'}
              onChange={(event) => setLocationStatus(setLocationForm, event.target.value)}
            >
              {enums.locationStatus.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            NBO
            <select
              className="input"
              value={locationForm.usa_nbo ? 'si' : 'no'}
              onChange={(event) => setBooleanSelect(setLocationForm, 'usa_nbo', event.target.value)}
            >
              <option value="si">Si</option>
              <option value="no">No</option>
            </select>
          </label>
          <label>
            Fecha de apertura
            <input
              type="date"
              className="input"
              value={locationForm.fecha_apertura || ''}
              onChange={(event) => setLocationForm({ ...locationForm, fecha_apertura: event.target.value })}
            />
          </label>
          {locationForm.status === 'cerrado' && (
            <label>
              Fecha de cierre
              <input
                type="date"
                className="input"
                value={locationForm.fecha_cierre || ''}
                onChange={(event) => setLocationForm({ ...locationForm, fecha_cierre: event.target.value })}
              />
            </label>
          )}
          <label className="full-row">
            Notas generales
            <textarea
              className="input"
              rows="3"
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
          <Link to={`/incidents?location_id=${numericLocationId}`} className="btn-link">
            Registrar caso TeamViewer
          </Link>
        </div>
        <div className="table-wrap table-wrap-xl">
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
                      <button type="button" className="btn-small" onClick={() => onCopyTeamviewerId(device)}>
                        Copiar TV ID
                      </button>
                      <button
                        type="button"
                        className="btn-small"
                        onClick={() => onOpenTeamviewer(device)}
                        disabled={runningActionKey === `tv-${device.id}`}
                      >
                        {runningActionKey === `tv-${device.id}` ? 'Abriendo...' : 'Abrir TeamViewer'}
                      </button>
                      <button type="button" className="btn-small" onClick={() => onEditDevice(device)}>
                        Editar
                      </button>
                      <button
                        type="button"
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
        </div>

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
        <div className="section-head">
          <h3>Resumen TeamViewer</h3>
          <Link to={`/teamviewer-imported-cases?location_id=${numericLocationId}`} className="btn-link">
            Ver todos
          </Link>
        </div>

        <div className="incident-summary-total">
          <strong>{teamviewerCases.length}</strong>
          <span>casos TeamViewer visibles para este local</span>
        </div>

        <div className="incident-summary-list">
          {teamviewerCases.slice(0, 5).map((teamviewerCase) => (
            <article key={teamviewerCase.id} className="incident-summary-item">
              <div className="incident-summary-meta">
                <small>{formatDateTime(teamviewerCase.started_at)}</small>
                <span className="badge pending">TeamViewer</span>
              </div>
              <strong>{teamviewerCase.problem_description || teamviewerCase.note_raw || 'Caso sin descripcion'}</strong>
              <small>
                Resuelto por: {resolveTeamviewerCaseTechnician(teamviewerCase)}
              </small>
              <small>
                Solicitante: {teamviewerCase.requested_by || 'Sin solicitante'}
              </small>
              <Link
                to={`/teamviewer-imported-cases?location_id=${numericLocationId}`}
                className="btn-link"
              >
                Abrir casos
              </Link>
            </article>
          ))}
          {teamviewerCases.length === 0 && <div className="empty-row">Sin casos TeamViewer vinculados.</div>}
        </div>
      </section>

      <section className="section-card full-width">
        <h3>Tareas ({tasks.length})</h3>
        <div className="table-wrap">
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
        </div>
      </section>
    </div>
  );
}

export default LocationDetailPage;
