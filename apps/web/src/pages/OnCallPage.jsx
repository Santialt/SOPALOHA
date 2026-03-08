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
    assigned_to: '',
    backup_assigned_to: '',
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

function emptyTechnicianForm() {
  return {
    name: '',
    is_active: true,
    notes: ''
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

function OnCallPage() {
  const [shifts, setShifts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [currentShift, setCurrentShift] = useState(null);
  const [currentShiftError, setCurrentShiftError] = useState('');
  const [savingShift, setSavingShift] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingTechnician, setSavingTechnician] = useState(false);
  const [quickAssigning, setQuickAssigning] = useState(false);
  const [deletingShiftId, setDeletingShiftId] = useState(null);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [editingTechnicianId, setEditingTechnicianId] = useState(null);
  const [success, setSuccess] = useState('');
  const [shiftForm, setShiftForm] = useState(emptyShiftForm());
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm());
  const [technicianForm, setTechnicianForm] = useState(emptyTechnicianForm());
  const [quickAssignPrincipal, setQuickAssignPrincipal] = useState('');
  const [quickAssignBackup, setQuickAssignBackup] = useState('');
  const [calendarCursor, setCalendarCursor] = useState(() => startOfDay(new Date()));

  const { load, loading, error, setError } = useDataLoader(async () => {
    setCurrentShiftError('');
    const [shiftsData, templatesData, techniciansData, currentData] = await Promise.all([
      api.getOnCallShifts(),
      api.getOnCallTemplates(),
      api.getOnCallTechnicians(),
      api.getCurrentOnCallShift().catch((err) => {
        setCurrentShiftError(err.message || 'No se pudo cargar la guardia actual');
        return null;
      })
    ]);
    setShifts(shiftsData);
    setTemplates(templatesData);
    setTechnicians(techniciansData);
    setCurrentShift(currentData);
  }, []);

  const activeTechnicians = useMemo(
    () => technicians.filter((tech) => tech.is_active).map((tech) => tech.name),
    [technicians]
  );

  useEffect(() => {
    if (!quickAssignPrincipal && activeTechnicians.length > 0) {
      setQuickAssignPrincipal(activeTechnicians[0]);
    }
    if (quickAssignBackup && !activeTechnicians.includes(quickAssignBackup)) {
      setQuickAssignBackup('');
    }
  }, [activeTechnicians, quickAssignPrincipal, quickAssignBackup]);

  const onSubmitShift = async (event) => {
    event.preventDefault();
    setSavingShift(true);
    setError('');
    setSuccess('');

    const payload = {
      title: shiftForm.title,
      assigned_to: shiftForm.assigned_to,
      backup_assigned_to: shiftForm.backup_assigned_to || null,
      start_at: shiftForm.start_at,
      end_at: shiftForm.end_at,
      notes: shiftForm.notes || null
    };

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
      assigned_to: shift.assigned_to || '',
      backup_assigned_to: shift.backup_assigned_to || '',
      start_at: normalizeDatetimeInput(shift.start_at),
      end_at: normalizeDatetimeInput(shift.end_at),
      notes: shift.notes || ''
    });
  };

  const onCancelShiftEdit = () => {
    setEditingShiftId(null);
    setShiftForm(emptyShiftForm());
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

  const onQuickAssignTemplate = async (day, template) => {
    if (!quickAssignPrincipal) {
      setError('Debes indicar tecnico principal para crear la guardia.');
      return;
    }
    const notes = window.prompt('Notas (opcional)', '');

    const dateKey = buildDayKey(day);
    const endDate = template.crosses_to_next_day ? shiftDateByDays(dateKey, 1) : dateKey;

    const payload = {
      title: template.title,
      assigned_to: quickAssignPrincipal,
      backup_assigned_to:
        quickAssignBackup && quickAssignBackup !== quickAssignPrincipal ? quickAssignBackup : null,
      start_at: `${dateKey}T${template.start_time}`,
      end_at: `${endDate}T${template.end_time}`,
      notes: notes && notes.trim() ? notes.trim() : null
    };

    setQuickAssigning(true);
    setError('');
    setSuccess('');

    try {
      await api.createOnCallShift(payload);
      setSuccess(`Guardia creada para ${template.title} el ${dateKey}.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setQuickAssigning(false);
    }
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
      }
      setSuccess(`Guardia #${shift.id} eliminada.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingShiftId(null);
    }
  };

  const onSubmitTechnician = async (event) => {
    event.preventDefault();
    setSavingTechnician(true);
    setError('');
    setSuccess('');

    const payload = {
      name: technicianForm.name,
      is_active: technicianForm.is_active,
      notes: technicianForm.notes || null
    };

    try {
      if (editingTechnicianId) {
        await api.updateOnCallTechnician(editingTechnicianId, payload);
        setSuccess(`Tecnico #${editingTechnicianId} actualizado.`);
      } else {
        await api.createOnCallTechnician(payload);
        setSuccess('Tecnico creado.');
      }

      setEditingTechnicianId(null);
      setTechnicianForm(emptyTechnicianForm());
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingTechnician(false);
    }
  };

  const onEditTechnician = (tech) => {
    setEditingTechnicianId(tech.id);
    setError('');
    setSuccess('');
    setTechnicianForm({
      name: tech.name || '',
      is_active: Boolean(tech.is_active),
      notes: tech.notes || ''
    });
  };

  const onCancelTechnicianEdit = () => {
    setEditingTechnicianId(null);
    setTechnicianForm(emptyTechnicianForm());
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

  if (loading) return <LoadingBlock label="Cargando guardias..." />;

  return (
    <div className="grid-two-columns">
      <div>
        <CurrentOnCallBlock shift={currentShift} error={currentShiftError} />

        <section className="section-card">
          <h2>{editingTechnicianId ? `Editar tecnico #${editingTechnicianId}` : 'Tecnicos predefinidos'}</h2>
          <InlineError message={error} />
          <InlineSuccess message={success} />

          <form onSubmit={onSubmitTechnician} className="form-grid form-grid-3">
            <label>
              Nombre *
              <input
                className="input"
                value={technicianForm.name}
                onChange={(event) => setTechnicianForm({ ...technicianForm, name: event.target.value })}
                required
              />
            </label>
            <label className="on-call-checkbox">
              <input
                type="checkbox"
                checked={technicianForm.is_active}
                onChange={(event) =>
                  setTechnicianForm({ ...technicianForm, is_active: event.target.checked })
                }
              />
              Activo para asignacion
            </label>
            <label className="full-row">
              Notas
              <input
                className="input"
                value={technicianForm.notes}
                onChange={(event) => setTechnicianForm({ ...technicianForm, notes: event.target.value })}
              />
            </label>
            <div className="form-actions full-row">
              <button type="submit" className="btn-primary" disabled={savingTechnician}>
                {savingTechnician ? 'Guardando...' : editingTechnicianId ? 'Guardar tecnico' : 'Crear tecnico'}
              </button>
              {editingTechnicianId && (
                <button type="button" className="btn-secondary" onClick={onCancelTechnicianEdit}>
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <table className="table compact">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Activo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {technicians.map((tech) => (
                <tr key={tech.id}>
                  <td>{tech.name}</td>
                  <td>{tech.is_active ? 'Si' : 'No'}</td>
                  <td>
                    <button type="button" className="btn-secondary" onClick={() => onEditTechnician(tech)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {technicians.length === 0 && (
                <tr>
                  <td colSpan="3" className="empty-row">Sin tecnicos</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="section-card">
          <h2>{editingTemplateId ? `Editar plantilla #${editingTemplateId}` : 'Plantillas de turno'}</h2>

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
                value={shiftForm.assigned_to}
                onChange={(event) => setShiftForm({ ...shiftForm, assigned_to: event.target.value })}
                required
              >
                <option value="">Seleccionar tecnico</option>
                {activeTechnicians.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
                {shiftForm.assigned_to && !activeTechnicians.includes(shiftForm.assigned_to) && (
                  <option value={shiftForm.assigned_to}>{shiftForm.assigned_to}</option>
                )}
              </select>
            </label>

            <label>
              Backup
              <select
                className="input"
                value={shiftForm.backup_assigned_to}
                onChange={(event) => setShiftForm({ ...shiftForm, backup_assigned_to: event.target.value })}
              >
                <option value="">Sin backup</option>
                {activeTechnicians.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
                {shiftForm.backup_assigned_to &&
                  !activeTechnicians.includes(shiftForm.backup_assigned_to) && (
                    <option value={shiftForm.backup_assigned_to}>{shiftForm.backup_assigned_to}</option>
                  )}
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
                  <td>{shift.assigned_to}</td>
                  <td>{shift.backup_assigned_to || '-'}</td>
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
        </section>
      </div>

      <section className="section-card">
        <div className="section-head wrap">
          <h2>Calendario de guardias</h2>
          <small>Cada dia muestra plantillas de turno para asignacion rapida.</small>
          <div className="task-calendar-toolbar">
            <div className="on-call-toolbar-assignees">
              <label>
                Principal
                <select
                  className="input"
                  value={quickAssignPrincipal}
                  onChange={(event) => setQuickAssignPrincipal(event.target.value)}
                >
                  <option value="">Seleccionar tecnico</option>
                  {activeTechnicians.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                Backup
                <select
                  className="input"
                  value={quickAssignBackup}
                  onChange={(event) => setQuickAssignBackup(event.target.value)}
                >
                  <option value="">Sin backup</option>
                  {activeTechnicians.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
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

                      return (
                        <article
                          key={`${buildDayKey(day)}-${template.id}`}
                          className={`on-call-slot-card ${isAssigned ? 'assigned' : 'empty'}`}
                          title={shift?.notes || template.title}
                        >
                          <div className="on-call-slot-title">{template.title}</div>
                          <div className="on-call-slot-main">
                            {isAssigned ? shift.assigned_to : 'Sin asignar'}
                          </div>
                          <div className="on-call-slot-sub">
                            {isAssigned
                              ? shift.backup_assigned_to
                                ? `Backup: ${shift.backup_assigned_to}`
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
                              <button
                                type="button"
                                className="btn-small"
                                onClick={() => onQuickAssignTemplate(day, template)}
                                disabled={quickAssigning}
                              >
                                Asignar
                              </button>
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
