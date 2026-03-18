import { useEffect, useMemo, useState } from 'react';
import CurrentOnCallBlock from '../components/CurrentOnCallBlock';
import InlineError from '../components/InlineError';
import InlineSuccess from '../components/InlineSuccess';
import LoadingBlock from '../components/LoadingBlock';
import { useDataLoader } from '../hooks/useDataLoader';
import { api } from '../services/api';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

const monthFormatter = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });
const dayFormatter = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' });

function emptyShiftForm() {
  return {
    title: '',
    assigned_user_id: '',
    backup_assigned_user_id: '',
    assigned_to_legacy: '',
    backup_assigned_to_legacy: '',
    start_at: '',
    end_at: '',
    notes: ''
  };
}

function emptyTemplateForm() {
  return {
    title: '',
    start_time: '09:00',
    end_time: '18:00',
    crosses_to_next_day: false
  };
}

function normalizeDatetimeInput(value) {
  if (!value) return '';
  return String(value).replace(' ', 'T').slice(0, 16);
}

function parseDateTime(value) {
  if (!value) return null;
  const normalized = String(value).includes(' ') ? String(value).replace(' ', 'T') : String(value);
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

function buildDayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildMonthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function shiftDateByDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return buildDayKey(date);
}

function overlapsDay(shift, dayStart, dayEnd) {
  const start = parseDateTime(shift.start_at);
  const end = parseDateTime(shift.end_at);
  if (!start || !end) return false;
  return start <= dayEnd && end >= dayStart;
}

function toDateTimeParts(value) {
  const date = parseDateTime(value);
  if (!date) return null;
  return {
    dateKey: buildDayKey(date),
    time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  };
}

function getShiftPrimaryLabel(shift) {
  return shift?.assigned_user_name || shift?.assigned_to || '-';
}

function getShiftBackupLabel(shift) {
  return shift?.backup_assigned_user_name || shift?.backup_assigned_to || '';
}

function hasSelectableUser(shift, users, fieldName) {
  const userId = shift?.[fieldName];
  return Boolean(userId && users.some((user) => user.id === userId));
}

function OnCallPage() {
  const [shifts, setShifts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentShift, setCurrentShift] = useState(null);
  const [currentShiftError, setCurrentShiftError] = useState('');
  const [savingShift, setSavingShift] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [calendarAssigning, setCalendarAssigning] = useState(false);
  const [deletingShiftId, setDeletingShiftId] = useState(null);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [success, setSuccess] = useState('');
  const [shiftForm, setShiftForm] = useState(emptyShiftForm());
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm());
  const [shiftPrincipalDirty, setShiftPrincipalDirty] = useState(false);
  const [shiftBackupDirty, setShiftBackupDirty] = useState(false);
  const [draggingUserId, setDraggingUserId] = useState(null);
  const [dragMode, setDragMode] = useState('primary');
  const [calendarDropSlotKey, setCalendarDropSlotKey] = useState('');
  const [calendarCursor, setCalendarCursor] = useState(() => startOfDay(new Date()));

  const editingShift = useMemo(
    () => shifts.find((shift) => shift.id === editingShiftId) || null,
    [shifts, editingShiftId]
  );
  const editingShiftHistoricalPrimary =
    editingShift && !hasSelectableUser(editingShift, users, 'assigned_user_id')
      ? getShiftPrimaryLabel(editingShift)
      : '';
  const editingShiftHistoricalBackup =
    editingShift && !hasSelectableUser(editingShift, users, 'backup_assigned_user_id')
      ? getShiftBackupLabel(editingShift)
      : '';

  const { load, loading, error, setError } = useDataLoader(async () => {
    setCurrentShiftError('');
    const [shiftsData, templatesData, usersData, currentData] = await Promise.all([
      api.getOnCallShifts(),
      api.getOnCallTemplates(),
      api.getAssignableUsers({ role: 'tech' }),
      api.getCurrentOnCallShift().catch((err) => {
        setCurrentShiftError(err.message || 'No se pudo cargar la guardia actual');
        return null;
      })
    ]);
    setShifts(shiftsData);
    setTemplates(templatesData);
    setUsers(usersData);
    setCurrentShift(currentData);
  }, []);

  useEffect(() => {
    if (draggingUserId && !users.some((user) => user.id === draggingUserId)) {
      setDraggingUserId(null);
    }
  }, [draggingUserId, users]);

  const buildShiftPayload = (formState = shiftForm) => {
    const payload = {
      title: formState.title,
      start_at: formState.start_at,
      end_at: formState.end_at,
      notes: formState.notes || null
    };

    if (formState.assigned_user_id) {
      payload.assigned_user_id = Number(formState.assigned_user_id);
    } else if (editingShiftId && !shiftPrincipalDirty && formState.assigned_to_legacy) {
      payload.assigned_to = formState.assigned_to_legacy;
    }

    if (formState.backup_assigned_user_id) {
      payload.backup_assigned_user_id = Number(formState.backup_assigned_user_id);
    } else if (editingShiftId && !shiftBackupDirty && formState.backup_assigned_to_legacy) {
      payload.backup_assigned_to = formState.backup_assigned_to_legacy;
    } else {
      payload.backup_assigned_user_id = null;
      payload.backup_assigned_to = null;
    }

    return payload;
  };

  const onSubmitShift = async (event) => {
    event.preventDefault();
    setSavingShift(true);
    setError('');
    setSuccess('');

    const payload = buildShiftPayload();

    try {
      if (editingShiftId) {
        await api.updateOnCallShift(editingShiftId, payload);
        setSuccess(`Guardia #${editingShiftId} actualizada.`);
      } else {
        await api.createOnCallShift(payload);
        setSuccess('Guardia creada.');
      }

      setEditingShiftId(null);
      setShiftForm(emptyShiftForm());
      setShiftPrincipalDirty(false);
      setShiftBackupDirty(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingShift(false);
    }
  };

  const onEditShift = (shift) => {
    setEditingShiftId(shift.id);
    setError('');
    setSuccess('');
    setShiftForm({
      title: shift.title || '',
      assigned_user_id: hasSelectableUser(shift, users, 'assigned_user_id') ? String(shift.assigned_user_id) : '',
      backup_assigned_user_id: hasSelectableUser(shift, users, 'backup_assigned_user_id')
        ? String(shift.backup_assigned_user_id)
        : '',
      assigned_to_legacy: getShiftPrimaryLabel(shift) === '-' ? '' : getShiftPrimaryLabel(shift),
      backup_assigned_to_legacy: getShiftBackupLabel(shift),
      start_at: normalizeDatetimeInput(shift.start_at),
      end_at: normalizeDatetimeInput(shift.end_at),
      notes: shift.notes || ''
    });
    setShiftPrincipalDirty(false);
    setShiftBackupDirty(false);
  };

  const onCancelShiftEdit = () => {
    setEditingShiftId(null);
    setShiftForm(emptyShiftForm());
    setShiftPrincipalDirty(false);
    setShiftBackupDirty(false);
  };

  const onSubmitTemplate = async (event) => {
    event.preventDefault();
    setSavingTemplate(true);
    setError('');
    setSuccess('');

    const payload = {
      title: templateForm.title,
      start_time: templateForm.start_time,
      end_time: templateForm.end_time,
      crosses_to_next_day: templateForm.crosses_to_next_day
    };

    try {
      if (editingTemplateId) {
        await api.updateOnCallTemplate(editingTemplateId, payload);
        setSuccess(`Plantilla #${editingTemplateId} actualizada.`);
      } else {
        await api.createOnCallTemplate(payload);
        setSuccess('Plantilla creada.');
      }

      setEditingTemplateId(null);
      setTemplateForm(emptyTemplateForm());
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingTemplate(false);
    }
  };

  const onEditTemplate = (template) => {
    setEditingTemplateId(template.id);
    setError('');
    setSuccess('');
    setTemplateForm({
      title: template.title || '',
      start_time: template.start_time || '09:00',
      end_time: template.end_time || '18:00',
      crosses_to_next_day: Boolean(template.crosses_to_next_day)
    });
  };

  const onCancelTemplateEdit = () => {
    setEditingTemplateId(null);
    setTemplateForm(emptyTemplateForm());
  };

  const findShiftForDayTemplate = (day, template) => {
    const dayKey = buildDayKey(day);
    const expectedEndDate = template.crosses_to_next_day ? shiftDateByDays(dayKey, 1) : dayKey;

    const matches = shifts.filter((shift) => {
      const start = toDateTimeParts(shift.start_at);
      const end = toDateTimeParts(shift.end_at);
      if (!start || !end) return false;
      return (
        start.dateKey === dayKey &&
        start.time === template.start_time &&
        end.dateKey === expectedEndDate &&
        end.time === template.end_time &&
        (shift.title || '').trim().toLowerCase() === (template.title || '').trim().toLowerCase()
      );
    });

    if (matches.length === 0) return null;
    return matches.sort((a, b) => b.id - a.id)[0];
  };

  const buildTemplateShiftPayload = (day, template, user) => {
    const dateKey = buildDayKey(day);
    const endDate = template.crosses_to_next_day ? shiftDateByDays(dateKey, 1) : dateKey;

    return {
      title: template.title,
      assigned_user_id: user.id,
      start_at: `${dateKey}T${template.start_time}`,
      end_at: `${endDate}T${template.end_time}`,
      notes: null
    };
  };

  const buildExistingShiftPayload = (shift, overrides = {}) => {
    const payload = {
      title: overrides.title ?? shift.title ?? '',
      start_at: overrides.start_at ?? normalizeDatetimeInput(shift.start_at),
      end_at: overrides.end_at ?? normalizeDatetimeInput(shift.end_at),
      notes: overrides.notes ?? shift.notes ?? null
    };

    if (Object.prototype.hasOwnProperty.call(overrides, 'assigned_user_id')) {
      payload.assigned_user_id = overrides.assigned_user_id;
    } else if (shift.assigned_user_id) {
      payload.assigned_user_id = shift.assigned_user_id;
    } else if (shift.assigned_to) {
      payload.assigned_to = shift.assigned_to;
    }

    if (Object.prototype.hasOwnProperty.call(overrides, 'backup_assigned_user_id')) {
      payload.backup_assigned_user_id = overrides.backup_assigned_user_id;
    } else if (shift.backup_assigned_user_id) {
      payload.backup_assigned_user_id = shift.backup_assigned_user_id;
    } else if (shift.backup_assigned_to) {
      payload.backup_assigned_to = shift.backup_assigned_to;
    } else {
      payload.backup_assigned_user_id = null;
      payload.backup_assigned_to = null;
    }

    return payload;
  };

  const applyCalendarDrop = async (day, template, draggedUserId) => {
    const droppedUser = users.find((user) => user.id === draggedUserId);
    if (!droppedUser) {
      setError('El usuario seleccionado ya no esta disponible para guardias.');
      return;
    }

    const shift = findShiftForDayTemplate(day, template);

    if (dragMode === 'backup' && !shift) {
      setError('Primero asigna un tecnico principal para ese turno.');
      return;
    }

    if (
      shift &&
      ((dragMode === 'primary' && shift.backup_assigned_user_id === droppedUser.id) ||
        (dragMode === 'backup' && shift.assigned_user_id === droppedUser.id))
    ) {
      setError('El backup debe ser distinto del tecnico principal.');
      return;
    }

    setCalendarAssigning(true);
    setCalendarDropSlotKey('');
    setError('');
    setSuccess('');

    try {
      if (shift) {
        const payload =
          dragMode === 'primary'
            ? buildExistingShiftPayload(shift, { assigned_user_id: droppedUser.id })
            : buildExistingShiftPayload(shift, { backup_assigned_user_id: droppedUser.id });
        await api.updateOnCallShift(shift.id, payload);
        setSuccess(
          `Guardia #${shift.id} actualizada: ${dragMode === 'primary' ? 'principal' : 'backup'} ${droppedUser.name}.`
        );
      } else {
        await api.createOnCallShift(buildTemplateShiftPayload(day, template, droppedUser));
        setSuccess(`Guardia creada para ${template.title} el ${buildDayKey(day)}.`);
      }

      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCalendarAssigning(false);
      setDraggingUserId(null);
    }
  };

  const onDeleteShift = async (shift) => {
    const ok = window.confirm(`Eliminar la guardia "${shift.title}" (#${shift.id})?`);
    if (!ok) return;

    setDeletingShiftId(shift.id);
    setError('');
    setSuccess('');

    try {
      await api.deleteOnCallShift(shift.id);
      if (editingShiftId === shift.id) {
        setEditingShiftId(null);
        setShiftForm(emptyShiftForm());
        setShiftPrincipalDirty(false);
        setShiftBackupDirty(false);
      }
      setSuccess(`Guardia #${shift.id} eliminada.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingShiftId(null);
    }
  };

  const calendarDays = useMemo(() => {
    const start = startOfMonthGrid(calendarCursor);
    const end = endOfMonthGrid(calendarCursor);
    const days = [];
    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      days.push(new Date(cursor));
    }
    return days;
  }, [calendarCursor]);

  const onMoveCalendar = (direction) => {
    setCalendarCursor((prev) => addMonths(prev, direction));
  };

  const onGoToday = () => {
    setCalendarCursor(startOfDay(new Date()));
  };

  const onSelectCalendarMonthYear = (event) => {
    const raw = event.target.value;
    if (!raw) return;
    const parsed = new Date(`${raw}-01T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return;
    setCalendarCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  };

  const onDragStartUser = (event, user) => {
    setDraggingUserId(user.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(user.id));
  };

  const onDragEndUser = () => {
    setDraggingUserId(null);
    setCalendarDropSlotKey('');
  };

  const onDragOverSlot = (event, slotKey) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (calendarDropSlotKey !== slotKey) {
      setCalendarDropSlotKey(slotKey);
    }
  };

  const onDropUserInSlot = async (event, day, template) => {
    event.preventDefault();
    const draggedUserId = Number(event.dataTransfer.getData('text/plain'));
    setCalendarDropSlotKey('');
    if (!Number.isInteger(draggedUserId)) return;
    await applyCalendarDrop(day, template, draggedUserId);
  };

  if (loading) return <LoadingBlock label="Cargando guardias..." />;

  return (
    <div className="grid-two-columns">
      <div>
        <CurrentOnCallBlock shift={currentShift} error={currentShiftError} />

        <section className="section-card">
          <h2>{editingTemplateId ? `Editar plantilla #${editingTemplateId}` : 'Plantillas de turno'}</h2>
          <InlineError message={error} />
          <InlineSuccess message={success} />

          <form onSubmit={onSubmitTemplate} className="form-grid form-grid-3">
            <label>
              Titulo *
              <input
                className="input"
                value={templateForm.title}
                onChange={(event) => setTemplateForm({ ...templateForm, title: event.target.value })}
                required
              />
            </label>
            <label>
              Inicio *
              <input
                type="time"
                className="input"
                value={templateForm.start_time}
                onChange={(event) => setTemplateForm({ ...templateForm, start_time: event.target.value })}
                required
              />
            </label>
            <label>
              Fin *
              <input
                type="time"
                className="input"
                value={templateForm.end_time}
                onChange={(event) => setTemplateForm({ ...templateForm, end_time: event.target.value })}
                required
              />
            </label>
            <label className="full-row on-call-checkbox">
              <input
                type="checkbox"
                checked={templateForm.crosses_to_next_day}
                onChange={(event) =>
                  setTemplateForm({ ...templateForm, crosses_to_next_day: event.target.checked })
                }
              />
              Cruza al dia siguiente
            </label>
            <div className="form-actions full-row">
              <button type="submit" className="btn-primary" disabled={savingTemplate}>
                {savingTemplate ? 'Guardando...' : editingTemplateId ? 'Guardar plantilla' : 'Crear plantilla'}
              </button>
              {editingTemplateId && (
                <button type="button" className="btn-secondary" onClick={onCancelTemplateEdit}>
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <div className="table-wrap">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Titulo</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Cruza dia</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td>{template.title}</td>
                    <td>{template.start_time}</td>
                    <td>{template.end_time}</td>
                    <td>{template.crosses_to_next_day ? 'Si' : 'No'}</td>
                    <td>
                      <button type="button" className="btn-secondary" onClick={() => onEditTemplate(template)}>
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
                {templates.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty-row">Sin plantillas</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section-card">
          <h2>{editingShiftId ? `Editar guardia #${editingShiftId}` : 'Alta de guardia manual'}</h2>

          <form onSubmit={onSubmitShift} className="form-grid form-grid-3">
            <label className="full-row">
              Titulo *
              <input
                className="input"
                value={shiftForm.title}
                onChange={(event) => setShiftForm({ ...shiftForm, title: event.target.value })}
                required
              />
            </label>

            <label>
              Responsable principal *
              <select
                className="input"
                value={shiftForm.assigned_user_id}
                onChange={(event) => {
                  setShiftForm({ ...shiftForm, assigned_user_id: event.target.value });
                  setShiftPrincipalDirty(true);
                }}
                required={!editingShiftHistoricalPrimary}
              >
                <option value="">Seleccionar usuario tecnico</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </label>

            <label>
              Backup
              <select
                className="input"
                value={shiftForm.backup_assigned_user_id}
                onChange={(event) => {
                  setShiftForm({ ...shiftForm, backup_assigned_user_id: event.target.value });
                  setShiftBackupDirty(true);
                }}
              >
                <option value="">Sin backup</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </label>

            <label>
              Inicio *
              <input
                type="datetime-local"
                className="input"
                value={shiftForm.start_at}
                onChange={(event) => setShiftForm({ ...shiftForm, start_at: event.target.value })}
                required
              />
            </label>

            <label>
              Fin *
              <input
                type="datetime-local"
                className="input"
                value={shiftForm.end_at}
                onChange={(event) => setShiftForm({ ...shiftForm, end_at: event.target.value })}
                required
              />
            </label>

            {editingShiftHistoricalPrimary && !shiftPrincipalDirty && !shiftForm.assigned_user_id && (
              <div className="full-row">
                <small className="panel-caption">
                  Asignacion historica actual: {editingShiftHistoricalPrimary}. Se conserva mientras no reasignes el principal.
                </small>
              </div>
            )}
            {editingShiftHistoricalBackup && !shiftBackupDirty && !shiftForm.backup_assigned_user_id && (
              <div className="full-row">
                <small className="panel-caption">
                  Backup historico actual: {editingShiftHistoricalBackup}. Se conserva mientras no reasignes el backup.
                </small>
              </div>
            )}

            <label className="full-row">
              Notas
              <textarea
                rows="3"
                className="input"
                value={shiftForm.notes}
                onChange={(event) => setShiftForm({ ...shiftForm, notes: event.target.value })}
              />
            </label>

            <div className="form-actions full-row">
              <button type="submit" className="btn-primary" disabled={savingShift}>
                {savingShift ? 'Guardando...' : editingShiftId ? 'Guardar cambios' : 'Crear guardia'}
              </button>
              {editingShiftId && (
                <button type="button" className="btn-secondary" onClick={onCancelShiftEdit}>
                  Cancelar edicion
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="section-card">
          <div className="section-head">
            <h2>Listado de guardias</h2>
          </div>
          <div className="table-wrap table-wrap-wide">
            <table className="table compact">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Titulo</th>
                  <th>Principal</th>
                  <th>Backup</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift) => (
                  <tr key={shift.id}>
                    <td>{shift.id}</td>
                    <td>{shift.title}</td>
                    <td>{getShiftPrimaryLabel(shift)}</td>
                    <td>{getShiftBackupLabel(shift) || '-'}</td>
                    <td>{normalizeDatetimeInput(shift.start_at) || '-'}</td>
                    <td>{normalizeDatetimeInput(shift.end_at) || '-'}</td>
                    <td>
                      <div className="form-actions">
                        <button className="btn-secondary" onClick={() => onEditShift(shift)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => onDeleteShift(shift)}
                          disabled={deletingShiftId === shift.id}
                        >
                          {deletingShiftId === shift.id ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {shifts.length === 0 && (
                  <tr>
                    <td colSpan="7" className="empty-row">Sin guardias</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="section-card">
        <div className="section-head wrap">
          <h2>Calendario de guardias</h2>
          <small>Arrastra usuarios tecnicos activos sobre el calendario existente. El modo define si reasignas principal o backup.</small>
          <div className="task-calendar-toolbar">
            <div className="on-call-dnd-toolbar">
              <div className="form-actions">
                <button
                  type="button"
                  className={dragMode === 'primary' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setDragMode('primary')}
                >
                  Arrastrar principal
                </button>
                <button
                  type="button"
                  className={dragMode === 'backup' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setDragMode('backup')}
                >
                  Arrastrar backup
                </button>
              </div>
              <div className="on-call-dnd-user-list" aria-label="Usuarios tecnicos activos">
                {users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className={`on-call-dnd-user ${draggingUserId === user.id ? 'is-dragging' : ''}`}
                    draggable
                    onDragStart={(event) => onDragStartUser(event, user)}
                    onDragEnd={onDragEndUser}
                    title={`Arrastrar ${user.name}`}
                  >
                    <strong>{user.name}</strong>
                    <small>{dragMode === 'primary' ? 'Principal' : 'Backup'}</small>
                  </button>
                ))}
                {users.length === 0 && (
                  <div className="dashboard-empty-state">
                    No hay usuarios tecnicos activos disponibles para guardias.
                  </div>
                )}
              </div>
            </div>
            <div className="task-calendar-jump">
              <input
                type="month"
                className="input"
                value={buildMonthKey(calendarCursor)}
                onChange={onSelectCalendarMonthYear}
              />
            </div>
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
            <strong>{monthFormatter.format(calendarCursor)}</strong>
          </div>
        </div>

        <div className="task-calendar-scroll">
          <div className="task-calendar-grid-head">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>
          <div className="task-calendar-grid month">
            {calendarDays.map((day) => {
              const isToday = isSameDate(day, new Date());
              const isOutOfMonth = day.getMonth() !== calendarCursor.getMonth();
              const dayStart = startOfDay(day);
              const dayEnd = new Date(dayStart);
              dayEnd.setHours(23, 59, 59, 999);
              const dayShifts = shifts.filter((shift) => overlapsDay(shift, dayStart, dayEnd));
              const matchedShiftIds = new Set();

              return (
                <div
                  key={buildDayKey(day)}
                  className={`task-calendar-cell ${isToday ? 'is-today' : ''} ${isOutOfMonth ? 'is-muted' : ''}`}
                >
                  <div className="task-calendar-cell-head">
                    <span>{day.getDate()}</span>
                    <small>{dayFormatter.format(day)}</small>
                  </div>
                  <div className="on-call-slot-list">
                    {templates.map((template) => {
                      const shift = findShiftForDayTemplate(day, template);
                      if (shift) matchedShiftIds.add(shift.id);
                      const isAssigned = Boolean(shift);
                      const slotKey = `${buildDayKey(day)}-${template.id}`;

                      return (
                        <article
                          key={slotKey}
                          className={`on-call-slot-card ${isAssigned ? 'assigned' : 'empty'} ${calendarDropSlotKey === slotKey ? 'is-drop-target' : ''}`}
                          title={shift?.notes || template.title}
                          onDragOver={(event) => onDragOverSlot(event, slotKey)}
                          onDragLeave={() => {
                            if (calendarDropSlotKey === slotKey) setCalendarDropSlotKey('');
                          }}
                          onDrop={(event) => onDropUserInSlot(event, day, template)}
                        >
                          <div className="on-call-slot-title">{template.title}</div>
                          <div className="on-call-slot-main">
                            {isAssigned ? getShiftPrimaryLabel(shift) : 'Sin asignar'}
                          </div>
                          <div className="on-call-slot-sub">
                            {isAssigned
                              ? getShiftBackupLabel(shift)
                                ? `Backup: ${getShiftBackupLabel(shift)}`
                                : 'Sin backup'
                              : `${template.start_time} - ${template.end_time}`}
                          </div>
                          <div className="on-call-slot-actions">
                            {isAssigned ? (
                              <button
                                type="button"
                                className="btn-small"
                                onClick={() => onEditShift(shift)}
                              >
                                Editar
                              </button>
                            ) : (
                              <span className="on-call-slot-hint">
                                {calendarAssigning && draggingUserId
                                  ? 'Asignando...'
                                  : dragMode === 'primary'
                                    ? 'Solta principal'
                                    : 'Requiere principal'}
                              </span>
                            )}
                          </div>
                        </article>
                      );
                    })}
                    {dayShifts.length > matchedShiftIds.size && (
                      <div className="task-calendar-more">
                        +{dayShifts.length - matchedShiftIds.size} guardias fuera de plantilla
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

export default OnCallPage;
