import { useState } from 'react';
import InlineError from '../components/InlineError';
import InlineSuccess from '../components/InlineSuccess';
import LoadingBlock from '../components/LoadingBlock';
import { useDataLoader } from '../hooks/useDataLoader';
import { api } from '../services/api';

function LocationNotesPage() {
  const [saving, setSaving] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState(null);
  const [success, setSuccess] = useState('');
  const [notes, setNotes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ location_id: '', note: '' });

  const { load, loading, error, setError } = useDataLoader(async () => {
    const [notesData, locationsData] = await Promise.all([api.getLocationNotes(), api.getLocations()]);
    setNotes(notesData);
    setLocations(locationsData);
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.createLocationNote({ location_id: Number(form.location_id), note: form.note });
      setForm({ location_id: '', note: '' });
      setSuccess('Nota creada.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (note) => {
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

  if (loading) return <LoadingBlock label="Cargando notas..." />;

  return (
    <div className="grid-two-columns">
      <section className="section-card">
        <h2>Alta rapida de nota tecnica</h2>
        <InlineError message={error} />
        <InlineSuccess message={success} />

        <form onSubmit={onSubmit} className="form-grid">
          <label>
            Local *
            <select
              className="input"
              value={form.location_id}
              onChange={(event) => setForm({ ...form, location_id: event.target.value })}
              required
            >
              <option value="">Seleccionar</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </label>

          <label className="full-row">
            Nota *
            <textarea
              rows="5"
              className="input"
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
              required
            />
          </label>

          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Agregar nota'}
          </button>
        </form>
      </section>

      <section className="section-card">
        <h2>Listado de notas</h2>
        <table className="table compact">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Local</th>
              <th>Nota</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {notes.map((note) => {
              const location = locations.find((item) => item.id === note.location_id);
              return (
                <tr key={note.id}>
                  <td>{note.created_at}</td>
                  <td>{location?.name || `#${note.location_id}`}</td>
                  <td>{note.note}</td>
                  <td>
                    <button
                      className="btn-danger"
                      onClick={() => onDelete(note)}
                      disabled={deletingNoteId === note.id}
                    >
                      {deletingNoteId === note.id ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {notes.length === 0 && <tr><td colSpan="4" className="empty-row">Sin notas</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default LocationNotesPage;
