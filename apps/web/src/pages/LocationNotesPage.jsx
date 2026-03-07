import { useEffect, useState } from 'react';
import InlineError from '../components/InlineError';
import LoadingBlock from '../components/LoadingBlock';
import { api } from '../services/api';

function LocationNotesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ location_id: '', note: '' });

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const [notesData, locationsData] = await Promise.all([api.getLocationNotes(), api.getLocations()]);
      setNotes(notesData);
      setLocations(locationsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      await api.createLocationNote({ location_id: Number(form.location_id), note: form.note });
      setForm({ location_id: '', note: '' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingBlock label="Cargando notas..." />;

  return (
    <div className="grid-two-columns">
      <section className="section-card">
        <h2>Alta rapida de nota tecnica</h2>
        <InlineError message={error} />

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
                </tr>
              );
            })}
            {notes.length === 0 && <tr><td colSpan="3" className="empty-row">Sin notas</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default LocationNotesPage;
