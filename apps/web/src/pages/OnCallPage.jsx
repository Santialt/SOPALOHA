import { useMemo, useState } from 'react';
import CurrentOnCallBlock from '../components/CurrentOnCallBlock';
import InlineError from '../components/InlineError';
import InlineSuccess from '../components/InlineSuccess';
import LoadingBlock from '../components/LoadingBlock';
import { useDataLoader } from '../hooks/useDataLoader';
import { api } from '../services/api';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

const monthFormatter = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });
const dayFormatter = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' });

function emptyForm() {
  return {
    title: '',
    assigned_to: '',
    backup_assigned_to: '',
    start_at: '',
    end_at: '',
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

function overlapsDay(shift, dayStart, dayEnd) {
  const start = parseDateTime(shift.start_at);
  const end = parseDateTime(shift.end_at);
  if (!start || !end) return false;
  return start <= dayEnd && end >= dayStart;
}

function OnCallPage() {
  const [shifts, setShifts] = useState([]);
  const [currentShift, setCurrentShift] = useState(null);
  const [currentShiftError, setCurrentShiftError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [calendarCursor, setCalendarCursor] = useState(() => startOfDay(new Date()));

  const { load, loading, error, setError } = useDataLoader(async () => {
    const [shiftsData, currentData] = await Promise.all([
      api.getOnCallShifts(),
      api.getCurrentOnCallShift().catch((err) => {
        setCurrentShiftError(err.message || 'No se pudo cargar la guardia actual');
        return null;
      })
    ]);
    setShifts(shiftsData);
    setCurrentShift(currentData);
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      title: form.title,
      assigned_to: form.assigned_to,
      backup_assigned_to: form.backup_assigned_to || null,
      start_at: form.start_at,
      end_at: form.end_at,
      notes: form.notes || null
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
      setForm(emptyForm());
      setCurrentShiftError('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (shift) => {
    setEditingShiftId(shift.id);
    setError('');
    setSuccess('');
    setForm({
      title: shift.title || '',
      assigned_to: shift.assigned_to || '',
      backup_assigned_to: shift.backup_assigned_to || '',
      start_at: normalizeDatetimeInput(shift.start_at),
      end_at: normalizeDatetimeInput(shift.end_at),
      notes: shift.notes || ''
    });
  };

  const onCancelEdit = () => {
    setEditingShiftId(null);
    setForm(emptyForm());
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

  if (loading) return <LoadingBlock label="Cargando guardias..." />;

  return (
    <div className="grid-two-columns">
      <div>
        <CurrentOnCallBlock shift={currentShift} error={currentShiftError} />

        <section className="section-card">
          <h2>{editingShiftId ? `Editar guardia #${editingShiftId}` : 'Alta de guardia'}</h2>
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
              Responsable principal *
              <input
                className="input"
                value={form.assigned_to}
                onChange={(event) => setForm({ ...form, assigned_to: event.target.value })}
                required
              />
            </label>

            <label>
              Backup
              <input
                className="input"
                value={form.backup_assigned_to}
                onChange={(event) => setForm({ ...form, backup_assigned_to: event.target.value })}
              />
            </label>

            <label>
              Inicio *
              <input
                type="datetime-local"
                className="input"
                value={form.start_at}
                onChange={(event) => setForm({ ...form, start_at: event.target.value })}
                required
              />
            </label>

            <label>
              Fin *
              <input
                type="datetime-local"
                className="input"
                value={form.end_at}
                onChange={(event) => setForm({ ...form, end_at: event.target.value })}
                required
              />
            </label>

            <label className="full-row">
              Notas
              <textarea
                rows="3"
                className="input"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </label>

            <div className="form-actions full-row">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : editingShiftId ? 'Guardar cambios' : 'Crear guardia'}
              </button>
              {editingShiftId && (
                <button type="button" className="btn-secondary" onClick={onCancelEdit}>
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
                    <button className="btn-secondary" onClick={() => onEdit(shift)}>
                      Editar
                    </button>
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
              const visible = dayShifts.slice(0, 3);
              const hidden = dayShifts.length - visible.length;

              return (
                <div
                  key={buildDayKey(day)}
                  className={`task-calendar-cell ${isToday ? 'is-today' : ''} ${isOutOfMonth ? 'is-muted' : ''}`}
                >
                  <div className="task-calendar-cell-head">
                    <span>{day.getDate()}</span>
                    <small>{dayFormatter.format(day)}</small>
                  </div>
                  <div className="task-calendar-events">
                    {visible.map((shift) => (
                      <button
                        key={shift.id}
                        type="button"
                        className="task-calendar-event on-call"
                        onClick={() => onEdit(shift)}
                        title={`#${shift.id} - ${shift.title}`}
                      >
                        <span className="task-calendar-event-top">#{shift.id} {shift.assigned_to}</span>
                        <span className="task-calendar-event-title">{shift.title}</span>
                      </button>
                    ))}
                    {hidden > 0 && <div className="task-calendar-more">+{hidden} mas</div>}
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
