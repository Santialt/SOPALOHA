import { useState } from 'react';
import InlineError from '../components/InlineError';
import InlineSuccess from '../components/InlineSuccess';
import LoadingBlock from '../components/LoadingBlock';
import { useDataLoader } from '../hooks/useDataLoader';
import { api, enums } from '../services/api';

function WeeklyTasksPage() {
  const [saving, setSaving] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [success, setSuccess] = useState('');

  const [tasks, setTasks] = useState([]);
  const [locations, setLocations] = useState([]);

  const [form, setForm] = useState({
    location_id: '',
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo',
    due_date: ''
  });

  const { load, loading, error, setError } = useDataLoader(async () => {
    const [tasksData, locationsData] = await Promise.all([api.getWeeklyTasks(), api.getLocations()]);
    setTasks(tasksData);
    setLocations(locationsData);
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.createWeeklyTask({
        ...form,
        location_id: form.location_id ? Number(form.location_id) : null,
        due_date: form.due_date || null
      });

      setForm({
        location_id: '',
        title: '',
        description: '',
        priority: 'medium',
        status: 'todo',
        due_date: ''
      });

      setSuccess('Tarea creada.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onStatusChange = async (task, status) => {
    setUpdatingTaskId(task.id);
    setError('');
    setSuccess('');

    try {
      await api.updateWeeklyTask(task.id, {
        location_id: task.location_id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status,
        due_date: task.due_date
      });

      setSuccess(`Estado de tarea #${task.id} actualizado.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const onDelete = async (task) => {
    const ok = window.confirm(`Eliminar la tarea "${task.title}"?`);
    if (!ok) return;

    setDeletingTaskId(task.id);
    setError('');
    setSuccess('');

    try {
      await api.deleteWeeklyTask(task.id);
      setSuccess(`Tarea #${task.id} eliminada.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingTaskId(null);
    }
  };

  if (loading) return <LoadingBlock label="Cargando tareas..." />;

  return (
    <div className="grid-two-columns">
      <section className="section-card">
        <h2>Alta rapida de tarea semanal</h2>
        <InlineError message={error} />
        <InlineSuccess message={success} />

        <form onSubmit={onSubmit} className="form-grid">
          <label>
            Local
            <select
              className="input"
              value={form.location_id}
              onChange={(event) => setForm({ ...form, location_id: event.target.value })}
            >
              <option value="">Sin local</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
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
            Prioridad
            <select
              className="input"
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value })}
            >
              {enums.taskPriority.map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
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
              {enums.taskStatus.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          <label>
            Vencimiento
            <input
              type="date"
              className="input"
              value={form.due_date}
              onChange={(event) => setForm({ ...form, due_date: event.target.value })}
            />
          </label>

          <label className="full-row">
            Descripcion
            <textarea
              className="input"
              rows="3"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Crear tarea'}
          </button>
        </form>
      </section>

      <section className="section-card">
        <h2>Listado de tareas</h2>
        <table className="table compact">
          <thead>
            <tr>
              <th>ID</th>
              <th>Local</th>
              <th>Titulo</th>
              <th>Prioridad</th>
              <th>Estado</th>
              <th>Vence</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const location = locations.find((item) => item.id === task.location_id);
              return (
                <tr key={task.id}>
                  <td>{task.id}</td>
                  <td>{location?.name || '-'}</td>
                  <td>{task.title}</td>
                  <td><span className={`badge ${task.priority}`}>{task.priority}</span></td>
                  <td>
                    <select
                      className="input status-select"
                      value={task.status}
                      onChange={(event) => onStatusChange(task, event.target.value)}
                      disabled={updatingTaskId === task.id}
                    >
                      {enums.taskStatus.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td>{task.due_date || '-'}</td>
                  <td>
                    <button
                      className="btn-danger"
                      onClick={() => onDelete(task)}
                      disabled={deletingTaskId === task.id}
                    >
                      {deletingTaskId === task.id ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {tasks.length === 0 && <tr><td colSpan="7" className="empty-row">Sin tareas</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default WeeklyTasksPage;
