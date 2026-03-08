import { useEffect, useMemo, useState } from 'react';
import InlineError from '../components/InlineError';
import InlineSuccess from '../components/InlineSuccess';
import LoadingBlock from '../components/LoadingBlock';
import { api } from '../services/api';

function toDateInputValue(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function toDatetimeLocalValue(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-AR');
}

function normalizeDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function resolveTechnicianFromCase(row) {
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
  if (row.technician_username && !/^u\d+$/i.test(String(row.technician_username))) {
    return row.technician_username;
  }
  return row.technician_username || '-';
}

function TeamViewerImportedCasesPage() {
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [runningActionCaseId, setRunningActionCaseId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [summary, setSummary] = useState(null);
  const [discarded, setDiscarded] = useState([]);
  const [rows, setRows] = useState([]);
  const [locations, setLocations] = useState([]);

  const [importRange, setImportRange] = useState(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 7);
    return {
      from_date: toDateInputValue(from),
      to_date: toDateInputValue(now)
    };
  });

  const [listFilters, setListFilters] = useState({
    location_key: '',
    date_key: '',
    technician: '',
    keyword: ''
  });

  const [manualForm, setManualForm] = useState(() => {
    const now = new Date();
    return {
      started_at: toDatetimeLocalValue(now),
      ended_at: toDatetimeLocalValue(now),
      technician_display_name: '',
      teamviewer_group_name: '',
      note_raw: ''
    };
  });

  const loadRows = async () => {
    setLoading(true);
    setError('');

    try {
      const [casesData, incidentsData, locationsData] = await Promise.all([
        api.getTeamviewerImportedCases(),
        api.getIncidents(),
        api.getLocations()
      ]);
      setLocations(locationsData);

      const locationsById = new Map(locationsData.map((location) => [location.id, location]));

      const importedCaseRows = casesData.map((row) => {
        const location = row.location_id ? locationsById.get(row.location_id) : null;
        return {
          key: `tv-${row.id}`,
          source: 'teamviewer_case',
          source_id: row.id,
          linked_incident_id: row.linked_incident_id || null,
          location_id: row.location_id || null,
          local_label: location?.name || row.teamviewer_group_name || '-',
          started_at: row.started_at,
          ended_at: row.ended_at,
          technician: resolveTechnicianFromCase(row),
          requested_by: row.requested_by || '-',
          problem_description: row.problem_description || '-'
        };
      });

      const incidentRows = incidentsData.map((row) => {
        const location = row.location_id ? locationsById.get(row.location_id) : null;
        return {
          key: `incident-${row.id}`,
          source: 'incident',
          source_id: row.id,
          linked_incident_id: row.id,
          location_id: row.location_id || null,
          local_label: location?.name || `Local #${row.location_id || '-'}`,
          started_at: row.incident_date,
          ended_at: null,
          technician: '-',
          requested_by: '-',
          problem_description: row.description || row.title || '-'
        };
      });

      setRows([...importedCaseRows, ...incidentRows]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locationOptions = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const key = row.location_id ? `id:${row.location_id}` : `name:${row.local_label}`;
      if (!map.has(key)) {
        map.set(key, { key, label: row.local_label });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
  }, [rows]);

  const dateOptions = useMemo(() => {
    const set = new Set();
    for (const row of rows) {
      const dateKey = normalizeDateKey(row.started_at);
      if (dateKey) set.add(dateKey);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const technicianOptions = useMemo(() => {
    const set = new Set();
    for (const row of rows) {
      if (row.technician && row.technician !== '-') set.add(row.technician);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const keyword = listFilters.keyword.trim().toLowerCase();
    const sorted = [...rows].sort((a, b) => {
      const dateA = new Date(a.started_at).getTime();
      const dateB = new Date(b.started_at).getTime();
      return dateB - dateA;
    });

    return sorted.filter((row) => {
      const rowLocationKey = row.location_id ? `id:${row.location_id}` : `name:${row.local_label}`;
      const byLocation = !listFilters.location_key || listFilters.location_key === rowLocationKey;
      const byDate = !listFilters.date_key || normalizeDateKey(row.started_at) === listFilters.date_key;
      const byTechnician = !listFilters.technician || row.technician === listFilters.technician;
      const byKeyword = !keyword || row.problem_description.toLowerCase().includes(keyword);
      return byLocation && byDate && byTechnician && byKeyword;
    });
  }, [rows, listFilters]);

  const onImport = async () => {
    setImporting(true);
    setError('');
    setSuccess('');

    try {
      const result = await api.importTeamviewerCases(importRange);
      setSummary(result.summary);
      setDiscarded(Array.isArray(result.discarded) ? result.discarded : []);
      await loadRows();
      setSuccess('Importacion de casos finalizada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const onCreateManual = async (event) => {
    event.preventDefault();
    setSavingManual(true);
    setError('');
    setSuccess('');

    try {
      await api.createTeamviewerImportedCase({
        started_at: manualForm.started_at,
        ended_at: manualForm.ended_at || null,
        technician_display_name: manualForm.technician_display_name,
        teamviewer_group_name: manualForm.teamviewer_group_name,
        note_raw: manualForm.note_raw
      });
      setSuccess('Caso manual creado.');
      setManualForm((prev) => ({ ...prev, teamviewer_group_name: '', note_raw: '', technician_display_name: '' }));
      await loadRows();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingManual(false);
    }
  };

  const onDeleteCase = async (row) => {
    const ok = window.confirm(`Eliminar caso importado #${row.source_id}?`);
    if (!ok) return;
    setRunningActionCaseId(row.source_id);
    setError('');
    setSuccess('');

    try {
      await api.deleteTeamviewerImportedCase(row.source_id);
      setSuccess(`Caso #${row.source_id} eliminado.`);
      await loadRows();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunningActionCaseId(null);
    }
  };

  const onDeleteIncident = async (row) => {
    const ok = window.confirm(`Eliminar incidente #${row.source_id}?`);
    if (!ok) return;
    setRunningActionCaseId(row.source_id);
    setError('');
    setSuccess('');

    try {
      await api.deleteIncident(row.source_id);
      setSuccess(`Incidente #${row.source_id} eliminado.`);
      await loadRows();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunningActionCaseId(null);
    }
  };

  if (loading && rows.length === 0) {
    return <LoadingBlock label="Cargando casos e incidentes..." />;
  }

  return (
    <div>
      <section className="section-card">
        <h2>Importar casos desde TeamViewer</h2>
        <div className="form-grid form-grid-3">
          <label>
            Fecha desde
            <input
              className="input"
              type="date"
              value={importRange.from_date}
              onChange={(event) => setImportRange((prev) => ({ ...prev, from_date: event.target.value }))}
            />
          </label>
          <label>
            Fecha hasta
            <input
              className="input"
              type="date"
              value={importRange.to_date}
              onChange={(event) => setImportRange((prev) => ({ ...prev, to_date: event.target.value }))}
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="btn-primary" onClick={onImport} disabled={importing || loading}>
            {importing ? 'Importando...' : 'Importar rango'}
          </button>
        </div>
      </section>

      <section className="section-card">
        <h2>Agregar caso manual</h2>
        <form className="form-grid form-grid-3" onSubmit={onCreateManual}>
          <label>
            Inicio
            <input
              className="input"
              type="datetime-local"
              value={manualForm.started_at}
              onChange={(event) => setManualForm((prev) => ({ ...prev, started_at: event.target.value }))}
              required
            />
          </label>
          <label>
            Fin
            <input
              className="input"
              type="datetime-local"
              value={manualForm.ended_at}
              onChange={(event) => setManualForm((prev) => ({ ...prev, ended_at: event.target.value }))}
            />
          </label>
          <label>
            Tecnico (nombre visible)
            <input
              className="input"
              value={manualForm.technician_display_name}
              onChange={(event) => setManualForm((prev) => ({ ...prev, technician_display_name: event.target.value }))}
            />
          </label>
          <label>
            Grupo TeamViewer
            <input
              className="input"
              value={manualForm.teamviewer_group_name}
              onChange={(event) => setManualForm((prev) => ({ ...prev, teamviewer_group_name: event.target.value }))}
              required
            />
          </label>
          <label className="full-row">
            Comentario (formato: problema - solicitante)
            <input
              className="input"
              value={manualForm.note_raw}
              onChange={(event) => setManualForm((prev) => ({ ...prev, note_raw: event.target.value }))}
              required
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={savingManual}>
              {savingManual ? 'Guardando...' : 'Agregar caso manual'}
            </button>
          </div>
        </form>
      </section>

      <InlineError message={error} />
      <InlineSuccess message={success} />

      {summary && (
        <section className="section-card">
          <h2>Resumen de importacion</h2>
          <div className="key-value-grid">
            <div><strong>Total recibidos:</strong> {summary.total_received}</div>
            <div><strong>Total con nota:</strong> {summary.total_with_note}</div>
            <div><strong>Total validos por formato:</strong> {summary.total_valid_format}</div>
            <div><strong>Total insertados:</strong> {summary.total_inserted}</div>
            <div><strong>Total duplicados:</strong> {summary.total_duplicated}</div>
            <div><strong>Total descartados formato invalido:</strong> {summary.total_discarded_invalid_format}</div>
          </div>
        </section>
      )}

      {discarded.length > 0 && (
        <section className="section-card">
          <h2>Descartados (muestra)</h2>
          <table className="table compact">
            <thead>
              <tr>
                <th>External ID</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {discarded.slice(0, 20).map((row, index) => (
                <tr key={`${row.external_connection_id || 'no-id'}-${index}`}>
                  <td>{row.external_connection_id || '-'}</td>
                  <td>{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="section-card">
        <h2>Listado unificado (Incidentes + Casos importados)</h2>
        <div className="form-grid form-grid-3">
          <label>
            Local
            <select
              className="input"
              value={listFilters.location_key}
              onChange={(event) => setListFilters((prev) => ({ ...prev, location_key: event.target.value }))}
            >
              <option value="">Todos</option>
              {locationOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha
            <select
              className="input"
              value={listFilters.date_key}
              onChange={(event) => setListFilters((prev) => ({ ...prev, date_key: event.target.value }))}
            >
              <option value="">Todas</option>
              {dateOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tecnico
            <select
              className="input"
              value={listFilters.technician}
              onChange={(event) => setListFilters((prev) => ({ ...prev, technician: event.target.value }))}
            >
              <option value="">Todos</option>
              {technicianOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="full-row">
            Descripcion del problema (palabra/frase)
            <input
              className="input"
              value={listFilters.keyword}
              onChange={(event) => setListFilters((prev) => ({ ...prev, keyword: event.target.value }))}
              placeholder="Buscar por texto en la descripcion"
            />
          </label>
        </div>

        <div className="section-head">
          <small>{filteredRows.length} registros</small>
        </div>

        <table className="table compact">
          <thead>
            <tr>
              <th>Fecha inicio</th>
              <th>Fecha fin</th>
              <th>Tecnico</th>
              <th>Local</th>
              <th>Solicitante</th>
              <th>Descripcion del problema</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.key}>
                <td>{formatDateTime(row.started_at)}</td>
                <td>{formatDateTime(row.ended_at)}</td>
                <td>{row.technician}</td>
                <td>{row.local_label}</td>
                <td>{row.requested_by}</td>
                <td>{row.problem_description}</td>
                {row.source === 'teamviewer_case' ? (
                  <td>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => onDeleteCase(row)}
                      disabled={runningActionCaseId === row.source_id}
                    >
                      Eliminar
                    </button>
                  </td>
                ) : (
                  <td>
                    <div className="form-actions">
                      <span>{`Incidente #${row.source_id}`}</span>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => onDeleteIncident(row)}
                        disabled={runningActionCaseId === row.source_id}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan="7" className="empty-row">Sin resultados para los filtros actuales.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default TeamViewerImportedCasesPage;
