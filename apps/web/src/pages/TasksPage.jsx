import { useMemo, useState } from 'react';
import EntityCommentsPanel from '../components/EntityCommentsPanel';
import InlineError from '../components/InlineError';
import InlineSuccess from '../components/InlineSuccess';
import LoadingBlock from '../components/LoadingBlock';
import { useDataLoader } from '../hooks/useDataLoader';
import { api, enums } from '../services/api';

const KANBAN_STATUSES = ['pending', 'in_progress', 'blocked', 'done', 'cancelled'];
const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const MONTH_OPTIONS = [
  { value: 0, label: 'Enero' },
  { value: 1, label: 'Febrero' },
  { value: 2, label: 'Marzo' },
  { value: 3, label: 'Abril' },
  { value: 4, label: 'Mayo' },
  { value: 5, label: 'Junio' },
  { value: 6, label: 'Julio' },
  { value: 7, label: 'Agosto' },
  { value: 8, label: 'Septiembre' },
  { value: 9, label: 'Octubre' },
  { value: 10, label: 'Noviembre' },
  { value: 11, label: 'Diciembre' }
];

const statusLabels = {
  pending: 'Pending',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
  cancelled: 'Cancelled'
};

const monthFormatter = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });
const dayFormatter = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' });
const timeFormatter = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' });

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
    assigned_user_id: '',
    due_date: '',
    scheduled_for: '',
    task_type: 'general'
  };
}

function normalizeDatetimeInput(value) {
  if (!value) return '';
  return value.replace(' ', 'T').slice(0, 16);
}

function toDateFromTask(task) {
  const sourceValue = task.scheduled_for || task.due_date;
  if (!sourceValue) return null;

  let normalizedValue = String(sourceValue);
  if (normalizedValue.includes(' ')) {
    normalizedValue = normalizedValue.replace(' ', 'T');
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    normalizedValue = `${normalizedValue}T00:00:00`;
  }

  const parsedDate = new Date(normalizedValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfWeek(date) {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return startOfDay(addDays(date, mondayOffset));
}

function startOfMonthGrid(date) {
  return startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1));
}

function endOfMonthGrid(date) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const day = lastDay.getDay();
  const sundayOffset = day === 0 ? 0 : 7 - day;
  return startOfDay(addDays(lastDay, sundayOffset));
}

function isSameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildTaskUpdatePayload(task, nextStatus) {
  return {
    title: task.title || '',
    description: task.description || null,
    location_id: task.location_id ?? null,
    device_id: task.device_id ?? null,
    incident_id: task.incident_id ?? null,
    status: nextStatus,
    priority: task.priority || 'medium',
    assigned_to: task.assigned_to || null,
    assigned_user_id: task.assigned_user_id ?? null,
    due_date: task.due_date || null,
    scheduled_for: task.scheduled_for || null,
    task_type: task.task_type || 'general'
  };
}

function TasksPage() {
  const [saving, setSaving] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [statusUpdatingTaskId, setStatusUpdatingTaskId] = useState(null);
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [viewMode, setViewMode] = useState('kanban');
  const [calendarScope, setCalendarScope] = useState('month');
  const [calendarCursor, setCalendarCursor] = useState(() => startOfDay(new Date()));
  const [calendarUndatedTasks, setCalendarUndatedTasks] = useState([]);
  const [draggingUndatedTaskId, setDraggingUndatedTaskId] = useState(null);
  const [calendarDropDateKey, setCalendarDropDateKey] = useState('');
  const [movingTaskToCalendarId, setMovingTaskToCalendarId] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [locations, setLocations] = useState([]);
  const [devices, setDevices] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [users, setUsers] = useState([]);

  const [filters, setFilters] = useState({ status: '', priority: '', location_id: '' });
  const [form, setForm] = useState(emptyForm());
  const effectiveFilters =
    viewMode === 'kanban'
      ? { priority: filters.priority, location_id: filters.location_id }
      : filters;

  const { load, loading, error, setError } = useDataLoader(async () => {
    const requests = [
      api.getTasks(effectiveFilters),
      api.getLocations(),
      api.getDevices(),
      api.getIncidents(),
      api.getAssignableUsers()
    ];

    if (viewMode === 'calendar') {
      requests.push(api.getTasks());
    }

    const [tasksData, locationsData, devicesData, incidentsData, usersData, allTasksData = []] = await Promise.all(requests);

    setTasks(tasksData);
    setLocations(locationsData);
    setDevices(devicesData);
    setIncidents(incidentsData);
    setUsers(usersData);
    setCalendarUndatedTasks(
      viewMode === 'calendar' ? allTasksData.filter((task) => !toDateFromTask(task)) : []
    );
  }, [viewMode, filters.status, filters.priority, filters.location_id]);

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
      assigned_user_id: form.assigned_user_id ? Number(form.assigned_user_id) : null,
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
      setSelectedTaskId(null);
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
      assigned_user_id: task.assigned_user_id ? String(task.assigned_user_id) : '',
      due_date: task.due_date || '',
      scheduled_for: normalizeDatetimeInput(task.scheduled_for),
      task_type: task.task_type || 'general'
    });
    setSelectedTaskId(task.id);
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
      if (selectedTaskId === task.id) {
        setSelectedTaskId(null);
      }
      setSuccess(`Tarea #${task.id} eliminada.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingTaskId(null);
    }
  };

  const onQuickStatusChange = async (task, nextStatus) => {
    if (!nextStatus || nextStatus === task.status) return;

    setStatusUpdatingTaskId(task.id);
    setError('');
    setSuccess('');

    try {
      await api.updateTask(task.id, buildTaskUpdatePayload(task, nextStatus));
      setTasks((prevTasks) =>
        prevTasks.map((item) => (item.id === task.id ? { ...item, status: nextStatus } : item))
      );
      setSuccess(`Estado de tarea #${task.id} actualizado a ${nextStatus}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setStatusUpdatingTaskId(null);
    }
  };

  const onDragStartTask = (event, task) => {
    setDraggingTaskId(task.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(task.id));
  };

  const onDragEndTask = () => {
    setDraggingTaskId(null);
    setDragOverStatus('');
  };

  const onDragOverColumn = (event, status) => {
    event.preventDefault();
    if (dragOverStatus !== status) {
      setDragOverStatus(status);
    }
    event.dataTransfer.dropEffect = 'move';
  };

  const onDropInColumn = async (event, status) => {
    event.preventDefault();
    setDragOverStatus('');

    const draggedTaskId = Number(event.dataTransfer.getData('text/plain'));
    if (!Number.isInteger(draggedTaskId)) return;

    const task = tasks.find((item) => item.id === draggedTaskId);
    if (!task || task.status === status) return;

    await onQuickStatusChange(task, status);
  };

  const onDragStartUndatedTask = (event, task) => {
    setDraggingUndatedTaskId(task.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(task.id));
  };

  const onDragEndUndatedTask = () => {
    setDraggingUndatedTaskId(null);
    setCalendarDropDateKey('');
  };

  const onDragOverCalendarDay = (event, dayKey) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (calendarDropDateKey !== dayKey) {
      setCalendarDropDateKey(dayKey);
    }
  };

  const onDropUndatedTaskInCalendarDay = async (event, dayKey) => {
    event.preventDefault();
    setCalendarDropDateKey('');

    const draggedTaskId = Number(event.dataTransfer.getData('text/plain'));
    if (!Number.isInteger(draggedTaskId)) return;

    const task = calendarUndatedTasks.find((item) => item.id === draggedTaskId);
    if (!task) return;

    setMovingTaskToCalendarId(task.id);
    setError('');
    setSuccess('');

    try {
      const payload = buildTaskUpdatePayload(task, task.status || 'pending');
      payload.due_date = dayKey;
      payload.scheduled_for = null;
      await api.updateTask(task.id, payload);
      setSuccess(`Tarea #${task.id} asignada al ${dayKey}.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setMovingTaskToCalendarId(null);
      setDraggingUndatedTaskId(null);
    }
  };

  const tasksByStatus = KANBAN_STATUSES.reduce((acc, status) => {
    acc[status] = tasks.filter((task) => task.status === status);
    return acc;
  }, {});

  const calendarData = useMemo(() => {
    const taskEvents = tasks
      .map((task) => {
        const date = toDateFromTask(task);
        return {
          task,
          date,
          source: task.scheduled_for ? 'scheduled_for' : task.due_date ? 'due_date' : null
        };
      })
      .sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.getTime() - b.date.getTime();
      });

    const eventsByDay = {};

    for (const item of taskEvents) {
      if (!item.date) {
        continue;
      }

      const key = formatDateKey(item.date);
      if (!eventsByDay[key]) {
        eventsByDay[key] = [];
      }
      eventsByDay[key].push(item);
    }

    return {
      eventsByDay
    };
  }, [tasks]);

  const calendarYearOptions = useMemo(() => {
    const baseYear = calendarCursor.getFullYear();
    const years = new Set();

    for (let year = baseYear - 5; year <= baseYear + 5; year += 1) {
      years.add(year);
    }

    tasks.forEach((task) => {
      const date = toDateFromTask(task);
      if (date) years.add(date.getFullYear());
    });
    calendarUndatedTasks.forEach((task) => {
      const date = toDateFromTask(task);
      if (date) years.add(date.getFullYear());
    });

    return [...years].sort((a, b) => a - b);
  }, [calendarCursor, tasks, calendarUndatedTasks]);

  const calendarRange = useMemo(() => {
    if (calendarScope === 'month') {
      const start = startOfMonthGrid(calendarCursor);
      const end = endOfMonthGrid(calendarCursor);
      const days = [];
      for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
        days.push(new Date(cursor));
      }
      return { start, end, days };
    }

    const start = startOfWeek(calendarCursor);
    const end = addDays(start, 6);
    const days = [];
    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      days.push(new Date(cursor));
    }

    return { start, end, days };
  }, [calendarCursor, calendarScope]);

  const calendarTitle =
    calendarScope === 'month'
      ? monthFormatter.format(calendarCursor)
      : `${dayFormatter.format(calendarRange.start)} - ${dayFormatter.format(calendarRange.end)}`;

  const onMoveCalendar = (direction) => {
    setCalendarCursor((prev) =>
      calendarScope === 'month' ? addMonths(prev, direction) : addDays(prev, 7 * direction)
    );
  };

  const onGoToday = () => {
    setCalendarCursor(startOfDay(new Date()));
  };

  const onSelectCalendarMonth = (event) => {
    const nextMonth = Number(event.target.value);
    setCalendarCursor((prev) => new Date(prev.getFullYear(), nextMonth, 1));
  };

  const onSelectCalendarYear = (event) => {
    const nextYear = Number(event.target.value);
    setCalendarCursor((prev) => new Date(nextYear, prev.getMonth(), 1));
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
            <select
              className="input"
              value={form.assigned_user_id}
              onChange={(event) => {
                const selectedUser = users.find((item) => item.id === Number(event.target.value));
                setForm({
                  ...form,
                  assigned_user_id: event.target.value,
                  assigned_to: selectedUser?.name || ''
                });
              }}
            >
              <option value="">Sin usuario</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name} ({user.role})</option>
              ))}
            </select>
          </label>

          <label>
            Asignado a (texto legacy)
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
          <h2>
            {viewMode === 'kanban'
              ? 'Tablero de tareas'
              : viewMode === 'calendar'
                ? 'Calendario de tareas'
                : 'Listado de tareas'}
          </h2>
          {viewMode === 'kanban' && <small>Arrastra y suelta tarjetas entre columnas para cambiar estado.</small>}
          {viewMode === 'calendar' && (
            <small>Eventos por scheduled_for y fallback a due_date. Click para editar la tarea.</small>
          )}
          <div className="form-actions">
            <button
              type="button"
              className={viewMode === 'kanban' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setViewMode('kanban')}
            >
              Kanban
            </button>
            <button
              type="button"
              className={viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setViewMode('list')}
            >
              Tabla
            </button>
            <button
              type="button"
              className={viewMode === 'calendar' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setViewMode('calendar')}
            >
              Calendario
            </button>
          </div>
          <div className="filter-row">
            {viewMode !== 'kanban' && (
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
            )}
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

        {viewMode === 'kanban' ? (
          <div className="kanban-board">
            {KANBAN_STATUSES.map((status) => {
              const columnTasks = tasksByStatus[status] || [];
              return (
                <article key={status} className={`kanban-column ${dragOverStatus === status ? 'is-drop-target' : ''}`}>
                  <header className="kanban-column-head">
                    <h3>{statusLabels[status] || status}</h3>
                    <span className={`badge ${status}`}>{columnTasks.length}</span>
                  </header>

                  <div
                    className="kanban-column-body"
                    onDragOver={(event) => onDragOverColumn(event, status)}
                    onDrop={(event) => onDropInColumn(event, status)}
                  >
                    {columnTasks.map((task) => {
                      const location = locations.find((item) => item.id === task.location_id);
                      return (
                        <div
                          key={task.id}
                          className={`kanban-card ${draggingTaskId === task.id ? 'is-dragging' : ''}`}
                          draggable
                          onDragStart={(event) => onDragStartTask(event, task)}
                          onDragEnd={onDragEndTask}
                        >
                          <div className="kanban-card-title">
                            #{task.id} - {task.title}
                          </div>
                          <div className="kanban-card-meta">
                            <span className={`badge ${task.priority}`}>{task.priority}</span>
                            <span>{location?.name || 'Sin local'}</span>
                          </div>
                          <div className="kanban-card-meta">
                            <span>Asignado: {task.assigned_to || '-'}</span>
                            <span>Vence: {task.due_date || '-'}</span>
                          </div>
                          <div className="kanban-card-actions">
                            <span className={`badge ${task.status}`}>{task.status}</span>
                            <button className="btn-secondary" onClick={() => onEdit(task)}>
                              Editar
                            </button>
                            <button className="btn-secondary" onClick={() => setSelectedTaskId(task.id)}>
                              Comentarios
                            </button>
                            <button
                              className="btn-danger"
                              onClick={() => onDelete(task)}
                              disabled={deletingTaskId === task.id || statusUpdatingTaskId === task.id}
                            >
                              {deletingTaskId === task.id ? 'Eliminando...' : 'Eliminar'}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {columnTasks.length === 0 && (
                      <div className="kanban-empty">Sin tareas en esta columna</div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : viewMode === 'calendar' ? (
          <div className="task-calendar-wrap">
            <div className="task-calendar-toolbar">
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => onMoveCalendar(-1)}>
                  Anterior
                </button>
                <button type="button" className="btn-secondary" onClick={onGoToday}>
                  Hoy
                </button>
                <button type="button" className="btn-secondary" onClick={() => onMoveCalendar(1)}>
                  Siguiente
                </button>
              </div>
              <strong>{calendarTitle}</strong>
              {calendarScope === 'month' && (
                <div className="task-calendar-jump">
                  <select
                    className="input"
                    value={calendarCursor.getMonth()}
                    onChange={onSelectCalendarMonth}
                  >
                    {MONTH_OPTIONS.map((month) => (
                      <option key={month.value} value={month.value}>{month.label}</option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={calendarCursor.getFullYear()}
                    onChange={onSelectCalendarYear}
                  >
                    {calendarYearOptions.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className={calendarScope === 'month' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setCalendarScope('month')}
                >
                  Mes
                </button>
                <button
                  type="button"
                  className={calendarScope === 'week' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setCalendarScope('week')}
                >
                  Semana
                </button>
              </div>
            </div>

            <div className="task-calendar-scroll">
              <div className="task-calendar-grid-head">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label}>{label}</div>
                ))}
              </div>

              <div className={`task-calendar-grid ${calendarScope === 'week' ? 'week' : 'month'}`}>
                {calendarRange.days.map((day) => {
                  const isToday = isSameDate(day, new Date());
                  const isOutOfMonth = calendarScope === 'month' && day.getMonth() !== calendarCursor.getMonth();
                  const dayKey = formatDateKey(day);
                  const dayEvents = calendarData.eventsByDay[dayKey] || [];
                  const maxEvents = calendarScope === 'month' ? 3 : 12;
                  const visibleEvents = dayEvents.slice(0, maxEvents);
                  const hiddenCount = dayEvents.length - visibleEvents.length;

                  return (
                    <div
                      key={dayKey}
                      className={`task-calendar-cell ${isToday ? 'is-today' : ''} ${isOutOfMonth ? 'is-muted' : ''} ${calendarDropDateKey === dayKey ? 'is-drop-target' : ''}`}
                      onDragOver={(event) => onDragOverCalendarDay(event, dayKey)}
                      onDrop={(event) => onDropUndatedTaskInCalendarDay(event, dayKey)}
                    >
                      <div className="task-calendar-cell-head">
                        <span>{day.getDate()}</span>
                        <small>{dayFormatter.format(day)}</small>
                      </div>
                      <div className="task-calendar-events">
                        {visibleEvents.map((eventItem) => (
                          <button
                            type="button"
                            key={`${eventItem.task.id}-${eventItem.source}-${eventItem.task.status}`}
                            className={`task-calendar-event priority-${eventItem.task.priority || 'medium'} status-${eventItem.task.status || 'pending'}`}
                            onClick={() => onEdit(eventItem.task)}
                            title={`#${eventItem.task.id} - ${eventItem.task.title}`}
                          >
                            <span className="task-calendar-event-top">
                              #{eventItem.task.id} {eventItem.source === 'scheduled_for' ? timeFormatter.format(eventItem.date) : 'todo el dia'}
                            </span>
                            <span className="task-calendar-event-title">{eventItem.task.title}</span>
                          </button>
                        ))}
                        {hiddenCount > 0 && <div className="task-calendar-more">+{hiddenCount} mas</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="task-calendar-undated">
              <h3>Tareas sin fecha ({calendarUndatedTasks.length})</h3>
              {calendarUndatedTasks.length === 0 ? (
                <div className="kanban-empty">No hay tareas sin scheduled_for o due_date.</div>
              ) : (
                <div className="task-calendar-undated-list">
                  {calendarUndatedTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className={`task-calendar-undated-item priority-${task.priority || 'medium'} status-${task.status || 'pending'}`}
                      draggable
                      onDragStart={(event) => onDragStartUndatedTask(event, task)}
                      onDragEnd={onDragEndUndatedTask}
                      onClick={() => onEdit(task)}
                      disabled={movingTaskToCalendarId === task.id}
                      title="Arrastra esta tarea a un dia del calendario para asignarle fecha"
                    >
                      <strong>#{task.id}</strong>
                      <span>{task.title}</span>
                      <small>{movingTaskToCalendarId === task.id ? 'Asignando fecha...' : draggingUndatedTaskId === task.id ? 'Solta en un dia del calendario' : 'Arrastrar al calendario'}</small>
                      <span className={`badge ${task.status}`}>{task.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="table-wrap table-wrap-xl">
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
                          <button className="btn-secondary" onClick={() => setSelectedTaskId(task.id)}>
                            Comentarios
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
          </div>
        )}
      </section>

      <EntityCommentsPanel
        entityId={selectedTaskId}
        entityLabel={selectedTaskId ? `de la tarea #${selectedTaskId}` : 'de tarea'}
        loadComments={api.getTaskComments}
        createComment={api.createTaskComment}
      />
    </div>
  );
}

export default TasksPage;
