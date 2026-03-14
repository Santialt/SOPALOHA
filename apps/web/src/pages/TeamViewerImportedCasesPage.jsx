import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import InlineError from '../components/InlineError';
import InlineSuccess from '../components/InlineSuccess';
import LoadingBlock from '../components/LoadingBlock';
import { api } from '../services/api';

const PAGE_SIZE = 50;

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
  const [searchParams] = useSearchParams();
  const prefillLocationId = Number(searchParams.get('location_id')) || '';
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
  const [pageOffset, setPageOffset] = useState(0);

  const [importRange, setImportRange] = useState(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 7);
    return {
      from_date: toDateInputValue(from),
      to_date: toDateInputValue(now)
    };
  });

  const [listFilters, setListFilters] = useState(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 30);
    return {
      location_id: prefillLocationId,
      from_date: toDateInputValue(from),
      to_date: toDateInputValue(now),
      technician: '',
      group: '',
      keyword: ''
    };
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

  const loadRows = async (offset = pageOffset) => {
    setLoading(true);
    setError('');

    try {
      const [casesData, locationsData] = await Promise.all([
        api.getTeamviewerImportedCases({
          ...listFilters,
          limit: PAGE_SIZE,
          offset
        }),
        api.getLocations()
      ]);
      setRows(casesData);
      setLocations(locationsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows(pageOffset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageOffset]);

  const locationOptions = useMemo(
    () => [...locations].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })),
    [locations]
  );

  const hasMore = rows.length === PAGE_SIZE;

  const onImport = async () => {
    setImporting(true);
    setError('');
    setSuccess('');

    try {
      const result = await api.importTeamviewerCases(importRange);
      setSummary(result.summary);
      setDiscarded(Array.isArray(result.discarded) ? result.discarded : []);
      setPageOffset(0);
      await loadRows(0);
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
      setPageOffset(0);
      await loadRows(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingManual(false);
    }
  };

  const onDeleteCase = async (row) => {
    const ok = window.confirm(`Eliminar caso importado #${row.id}?`);
    if (!ok) return;
    setRunningActionCaseId(row.id);
    setError('');
    setSuccess('');

    try {
      await api.deleteTeamviewerImportedCase(row.id);
      setSuccess(`Caso #${row.id} eliminado.`);
      await loadRows(pageOffset);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunningActionCaseId(null);
    }
  };

  const onApplyFilters = async () => {
    setPageOffset(0);
    await loadRows(0);
  };

  if (loading && rows.length === 0) {
    return <LoadingBlock label="Cargando casos TeamViewer..." />;
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
        <div className="section-head">
          <h2>Casos importados</h2>
          <small>{rows.length} cargados en esta pagina</small>
        </div>

        <div className="form-grid form-grid-3">
          <label>
            Local
            <select
              className="input"
              value={listFilters.location_id}
              onChange={(event) => setListFilters((prev) => ({ ...prev, location_id: event.target.value }))}
            >
              <option value="">Todos</option>
              {locationOptions.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha desde
            <input
              className="input"
              type="date"
              value={listFilters.from_date}
              onChange={(event) => setListFilters((prev) => ({ ...prev, from_date: event.target.value }))}
            />
          </label>
          <label>
            Fecha hasta
            <input
              className="input"
              type="date"
              value={listFilters.to_date}
              onChange={(event) => setListFilters((prev) => ({ ...prev, to_date: event.target.value }))}
            />
          </label>
          <label>
            Tecnico
            <input
              className="input"
              value={listFilters.technician}
              onChange={(event) => setListFilters((prev) => ({ ...prev, technician: event.target.value }))}
              placeholder="Nombre o username"
            />
          </label>
          <label>
            Grupo TeamViewer
            <input
              className="input"
              value={listFilters.group}
              onChange={(event) => setListFilters((prev) => ({ ...prev, group: event.target.value }))}
              placeholder="Grupo"
            />
          </label>
          <label>
            Texto
            <input
              className="input"
              value={listFilters.keyword}
              onChange={(event) => setListFilters((prev) => ({ ...prev, keyword: event.target.value }))}
              placeholder="Problema, solicitante o nota"
            />
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-primary" onClick={onApplyFilters} disabled={loading}>
            Aplicar filtros
          </button>
        </div>

        {loading ? (
          <LoadingBlock label="Actualizando casos..." />
        ) : (
          <>
            <table className="table compact">
              <thead>
                <tr>
                  <th>Fecha inicio</th>
                  <th>Fecha fin</th>
                  <th>Tecnico</th>
                  <th>Grupo</th>
                  <th>Local</th>
                  <th>Solicitante</th>
                  <th>Descripcion del problema</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const resolvedLocationId = row.resolved_location_id || row.location_id || null;
                  const location = resolvedLocationId
                    ? locations.find((item) => item.id === resolvedLocationId)
                    : null;
                  return (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.started_at)}</td>
                      <td>{formatDateTime(row.ended_at)}</td>
                      <td>{resolveTechnicianFromCase(row)}</td>
                      <td>{row.teamviewer_group_name || '-'}</td>
                      <td>{location?.name || row.resolved_location_name || row.teamviewer_group_name || '-'}</td>
                      <td>{row.requested_by || '-'}</td>
                      <td>{row.problem_description || '-'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() => onDeleteCase(row)}
                          disabled={runningActionCaseId === row.id}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan="8" className="empty-row">Sin resultados para los filtros actuales.</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPageOffset((prev) => Math.max(prev - PAGE_SIZE, 0))}
                disabled={loading || pageOffset === 0}
              >
                Pagina anterior
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPageOffset((prev) => prev + PAGE_SIZE)}
                disabled={loading || !hasMore}
              >
                Pagina siguiente
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default TeamViewerImportedCasesPage;
