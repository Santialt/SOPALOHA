import { useState } from 'react';
import InlineError from '../components/InlineError';
import InlineSuccess from '../components/InlineSuccess';
import LoadingBlock from '../components/LoadingBlock';
import { useDataLoader } from '../hooks/useDataLoader';
import { api, enums } from '../services/api';

function emptyForm() {
  return {
    title: '',
    description: '',
    location_id: '',
    device_id: '',
    incident_id: '',
    status: 'pending',
    priority: 'medium',
    assigned_to: '',
    due_date: '',
    scheduled_for: '',
    task_type: 'general'
  };
}

function normalizeDatetimeInput(value) {
  if (!value) return '';
  return value.replace(' ', 'T').slice(0, 16);
}

function TasksPage() {
  const [saving, setSaving] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [success, setSuccess] = useState('');

  const [tasks, setTasks] = useState([]);
  const [locations, setLocations] = useState([]);
  const [devices, setDevices] = useState([]);
  const [incidents, setIncidents] = useState([]);

  const [filters, setFilters] = useState({ status: '', priority: '', location_id: '' });
  const [form, setForm] = useState(emptyForm());

  const { load, loading, error, setError } = useDataLoader(async () => {
    const [tasksData, locationsData, devicesData, incidentsData] = await Promise.all([
      api.getTasks(filters),
      api.getLocations(),
      api.getDevices(),
      api.getIncidents()
    ]);

    setTasks(tasksData);
    setLocations(locationsData);
    setDevices(devicesData);
    setIncidents(incidentsData);
  }, [filters.status, filters.priority, filters.location_id]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      ...form,
      location_id: form.location_id ? Number(form.location_id) : null,
      device_id: form.device_id ? Number(form.device_id) : null,
      incident_id: form.incident_id ? Number(form.incident_id) : null,
      due_date: form.due_date || null,
      scheduled_for: form.scheduled_for || null,
      assigned_to: form.assigned_to || null
    };

    try {
      if (editingTaskId) {
        await api.updateTask(editingTaskId, payload);
        setSuccess(`Tarea #${editingTaskId} actualizada.`);
      } else {
        await api.createTask(payload);
        setSuccess('Tarea creada.');
      }

      setEditingTaskId(null);
      setForm(emptyForm());
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (task) => {
    setEditingTaskId(task.id);
    setError('');
    setSuccess('');
    setForm({
      title: task.title || '',
      description: task.description || '',
      location_id: task.location_id ? String(task.location_id) : '',
      device_id: task.device_id ? String(task.device_id) : '',
      incident_id: task.incident_id ? String(task.incident_id) : '',
      status: task.status || 'pending',
      priority: task.priority || 'medium',
      assigned_to: task.assigned_to || '',
      due_date: task.due_date || '',
      scheduled_for: normalizeDatetimeInput(task.scheduled_for),
      task_type: task.task_type || 'general'
    });
  };

  const onCancelEdit = () => {
    setEditingTaskId(null);
    setForm(emptyForm());
  };

  const onDelete = async (task) => {
    const ok = window.confirm(`Eliminar la tarea "${task.title}"?`);
    if (!ok) return;

    setDeletingTaskId(task.id);
    setError('');
    setSuccess('');

    try {
      await api.deleteTask(task.id);
      if (editingTaskId === task.id) {
        setEditingTaskId(null);
        setForm(emptyForm());
      }
      setSuccess(`Tarea #${task.id} eliminada.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingTaskId(null);
    }
  };

  if (loading) return <LoadingBlock label="Cargando tareas operativas..." />;

  return (
    <div className="grid-two-columns">
      <section className="section-card">
        <h2>{editingTaskId ? `Editar tarea #${editingTaskId}` : 'Alta de tarea'}</h2>
        <InlineError message={error} />
        <InlineSuccess message={success} />

        <form onSubmit={onSubmit} className="form-grid form-grid-3">
          <label className="full-row">
            Titulo *
            <input
              className="input"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              required
            />
          </label>

          <label>
            Estado
            <select
              className="input"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              {enums.operationalTaskStatus.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          <label>
            Prioridad
            <select
              className="input"
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value })}
            >
              {enums.operationalTaskPriority.map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
          </label>

          <label>
            Tipo de tarea
            <input
              className="input"
              value={form.task_type}
              onChange={(event) => setForm({ ...form, task_type: event.target.value })}
            />
          </label>

          <label>
            Local
            <select
              className="input"
              value={form.location_id}
              onChange={(event) => setForm({ ...form, location_id: event.target.value, device_id: '' })}
            >
              <option value="">Sin local</option>
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
            Incidente
            <select
              className="input"
              value={form.incident_id}
              onChange={(event) => setForm({ ...form, incident_id: event.target.value })}
            >
              <option value="">Sin incidente</option>
              {incidents.map((incident) => (
                <option key={incident.id} value={incident.id}>
                  #{incident.id} - {incident.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            Asignado a
            <input
              className="input"
              value={form.assigned_to}
              onChange={(event) => setForm({ ...form, assigned_to: event.target.value })}
            />
          </label>

          <label>
            Vence
            <input
              type="date"
              className="input"
              value={form.due_date}
              onChange={(event) => setForm({ ...form, due_date: event.target.value })}
            />
          </label>

          <label>
            Programada para
            <input
              type="datetime-local"
              className="input"
              value={form.scheduled_for}
              onChange={(event) => setForm({ ...form, scheduled_for: event.target.value })}
            />
          </label>

          <label className="full-row">
            Descripcion
            <textarea
              rows="3"
              className="input"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>

          <div className="form-actions full-row">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editingTaskId ? 'Guardar cambios' : 'Crear tarea'}
            </button>
            {editingTaskId && (
              <button type="button" className="btn-secondary" onClick={onCancelEdit}>
                Cancelar edicion
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="section-card">
        <div className="section-head wrap">
          <h2>Listado de tareas</h2>
          <div className="filter-row">
            <select
              className="input"
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            >
              <option value="">Todos los estados</option>
              {enums.operationalTaskStatus.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select
              className="input"
              value={filters.priority}
              onChange={(event) => setFilters({ ...filters, priority: event.target.value })}
            >
              <option value="">Todas las prioridades</option>
              {enums.operationalTaskPriority.map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
            <select
              className="input"
              value={filters.location_id}
              onChange={(event) => setFilters({ ...filters, location_id: event.target.value })}
            >
              <option value="">Todos los locales</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </div>
        </div>

        <table className="table compact">
          <thead>
            <tr>
              <th>ID</th>
              <th>Titulo</th>
              <th>Local</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th>Asignado</th>
              <th>Vence</th>
              <th>Programada</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const location = locations.find((item) => item.id === task.location_id);
              return (
                <tr key={task.id}>
                  <td>{task.id}</td>
                  <td>{task.title}</td>
                  <td>{location?.name || '-'}</td>
                  <td><span className={`badge ${task.status}`}>{task.status}</span></td>
                  <td><span className={`badge ${task.priority}`}>{task.priority}</span></td>
                  <td>{task.assigned_to || '-'}</td>
                  <td>{task.due_date || '-'}</td>
                  <td>{normalizeDatetimeInput(task.scheduled_for) || '-'}</td>
                  <td>
                    <div className="form-actions">
                      <button className="btn-secondary" onClick={() => onEdit(task)}>
                        Editar
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() => onDelete(task)}
                        disabled={deletingTaskId === task.id}
                      >
                        {deletingTaskId === task.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {tasks.length === 0 && (
              <tr>
                <td colSpan="9" className="empty-row">Sin tareas</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default TasksPage;
