import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';
import DataTable from '../components/DataTable';
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

function buildActiveFiltersSummary(filters) {
  const parts = [];
  if (filters.location_id) parts.push('local');
  if (filters.from_date || filters.to_date) parts.push('rango');
  if (filters.technician_user_id) parts.push('tecnico');
  if (filters.group) parts.push('grupo');
  if (filters.keyword.trim()) parts.push('texto');

  if (parts.length === 0) {
    return 'Sin filtros activos.';
  }

  return `Filtros activos: ${parts.join(', ')}.`;
}

function resolveTechnicianFromCase(row) {
  if (row.technician_user_name) return row.technician_user_name;
  if (row.technician_display_name) return row.technician_display_name;
  if (row.technician_username && !/^u\d+$/i.test(String(row.technician_username))) {
    return row.technician_username;
  }
  return row.technician_username || '-';
}

function createCurrentMonthDateRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from_date: toDateInputValue(firstDay),
    to_date: toDateInputValue(now)
  };
}

function createInitialListFilters(prefillLocationId) {
  const currentMonthRange = createCurrentMonthDateRange();
  return {
    location_id: prefillLocationId,
    from_date: currentMonthRange.from_date,
    to_date: currentMonthRange.to_date,
    technician_user_id: '',
    group: '',
    keyword: ''
  };
}

function TeamViewerImportedCasesPage() {
  const [searchParams] = useSearchParams();
  const prefillLocationId = Number(searchParams.get('location_id')) || '';
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [importing, setImporting] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [runningActionCaseId, setRunningActionCaseId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [summary, setSummary] = useState(null);
  const [discarded, setDiscarded] = useState([]);
  const [rows, setRows] = useState([]);
  const [locations, setLocations] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [teamviewerGroups, setTeamviewerGroups] = useState([]);
  const [pageOffset, setPageOffset] = useState(0);
  const [lastSubmittedFilters, setLastSubmittedFilters] = useState(null);

  const [importRange, setImportRange] = useState(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 7);
    return {
      from_date: toDateInputValue(from),
      to_date: toDateInputValue(now)
    };
  });

  const [listFilters, setListFilters] = useState(() => createInitialListFilters(prefillLocationId));
  const [manualForm, setManualForm] = useState(() => {
    const now = new Date();
    return {
      started_at: toDatetimeLocalValue(now),
      ended_at: toDatetimeLocalValue(now),
      technician_user_id: '',
      teamviewer_group_name: '',
      note_raw: ''
    };
  });

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogs() {
      setCatalogLoading(true);
      setError('');

      try {
        const [locationsData, catalogsData] = await Promise.all([
          api.getLocations(),
          api.getTeamviewerImportedCaseCatalogs()
        ]);

        if (cancelled) return;

        setLocations(Array.isArray(locationsData) ? locationsData : []);
        setTechnicians(Array.isArray(catalogsData?.technicians) ? catalogsData.technicians : []);
        setTeamviewerGroups(Array.isArray(catalogsData?.teamviewer_groups) ? catalogsData.teamviewer_groups : []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    loadCatalogs();
    return () => {
      cancelled = true;
    };
  }, []);

  const locationOptions = useMemo(
    () => [...locations].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })),
    [locations]
  );
  const technicianOptions = useMemo(
    () => [...technicians].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })),
    [technicians]
  );
  const groupOptions = useMemo(
    () =>
      [...teamviewerGroups].sort((a, b) =>
        a.group_name.localeCompare(b.group_name, 'es', { sensitivity: 'base' })
      ),
    [teamviewerGroups]
  );
  const selectedManualGroup = useMemo(
    () => groupOptions.find((group) => group.group_name === manualForm.teamviewer_group_name) || null,
    [groupOptions, manualForm.teamviewer_group_name]
  );
  const hasDateRangeSelected = Boolean(listFilters.from_date || listFilters.to_date);
  const hasMore = rows.length === PAGE_SIZE;
  const activeFiltersSummary = buildActiveFiltersSummary(listFilters);

  const loadRows = async (filters, offset = 0) => {
    setLoading(true);
    setError('');

    try {
      const casesData = await api.getTeamviewerImportedCases({
        ...filters,
        limit: PAGE_SIZE,
        offset
      });
      setRows(Array.isArray(casesData) ? casesData : []);
      setHasSearched(true);
      setLastSubmittedFilters(filters);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onImport = async () => {
    setImporting(true);
    setError('');
    setSuccess('');

    try {
      const result = await api.importTeamviewerCases(importRange);
      setSummary(result.summary);
      setDiscarded(Array.isArray(result.discarded) ? result.discarded : []);
      setSuccess('Importacion de casos finalizada.');

      const catalogsData = await api.getTeamviewerImportedCaseCatalogs();
      setTechnicians(Array.isArray(catalogsData?.technicians) ? catalogsData.technicians : []);
      setTeamviewerGroups(Array.isArray(catalogsData?.teamviewer_groups) ? catalogsData.teamviewer_groups : []);

      if (lastSubmittedFilters) {
        setPageOffset(0);
        await loadRows(lastSubmittedFilters, 0);
      }
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
        technician_user_id: manualForm.technician_user_id,
        teamviewer_group_name: manualForm.teamviewer_group_name,
        location_id: selectedManualGroup?.location_id || null,
        note_raw: manualForm.note_raw
      });

      setSuccess('Caso manual creado.');
      setManualForm((prev) => ({
        ...prev,
        technician_user_id: '',
        teamviewer_group_name: '',
        note_raw: ''
      }));

      const catalogsData = await api.getTeamviewerImportedCaseCatalogs();
      setTechnicians(Array.isArray(catalogsData?.technicians) ? catalogsData.technicians : []);
      setTeamviewerGroups(Array.isArray(catalogsData?.teamviewer_groups) ? catalogsData.teamviewer_groups : []);

      if (lastSubmittedFilters) {
        setPageOffset(0);
        await loadRows(lastSubmittedFilters, 0);
      }
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

      if (lastSubmittedFilters) {
        await loadRows(lastSubmittedFilters, pageOffset);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRunningActionCaseId(null);
    }
  };

  const onApplyFilters = async () => {
    if (!hasDateRangeSelected) {
      setError('Selecciona fecha desde, fecha hasta o ambas antes de buscar.');
      return;
    }

    const nextFilters = { ...listFilters };
    setPageOffset(0);
    await loadRows(nextFilters, 0);
  };

  const onResetFilters = () => {
    const initialFilters = createInitialListFilters(prefillLocationId);
    setListFilters(initialFilters);
    setPageOffset(0);
    setError('');
    setSuccess('');
    loadRows(initialFilters, 0);
  };

  useEffect(() => {
    const initialFilters = createInitialListFilters(prefillLocationId);
    setListFilters(initialFilters);
    setPageOffset(0);
    loadRows(initialFilters, 0);
  }, [prefillLocationId]);

  useEffect(() => {
    if (!lastSubmittedFilters || pageOffset === 0) return;
    loadRows(lastSubmittedFilters, pageOffset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageOffset]);

  if (catalogLoading) {
    return <LoadingBlock label="Cargando catalogos de casos TeamViewer..." />;
  }

  const tableColumns = [
    { key: 'started_at', header: 'Inicio' },
    { key: 'ended_at', header: 'Fin' },
    { key: 'technician', header: 'Tecnico' },
    { key: 'group', header: 'Grupo' },
    { key: 'location', header: 'Local' },
    { key: 'requester', header: 'Solicitante' },
    { key: 'problem', header: 'Problema' },
    { key: 'actions', header: 'Acciones' }
  ];

  const tableRows = rows.map((row) => {
    const resolvedLocationId = row.resolved_location_id || row.location_id || null;
    const location = resolvedLocationId ? locations.find((item) => item.id === resolvedLocationId) : null;

    return {
      key: row.id,
      cells: [
        formatDateTime(row.started_at),
        formatDateTime(row.ended_at),
        resolveTechnicianFromCase(row),
        row.teamviewer_group_name || '-',
        location?.name || row.resolved_location_name || row.teamviewer_group_name || '-',
        row.requested_by || '-',
        row.problem_description || '-',
        <Button
          key={`delete-${row.id}`}
          variant="danger"
          onClick={() => onDeleteCase(row)}
          disabled={runningActionCaseId === row.id}
        >
          Eliminar
        </Button>
      ]
    };
  });

  return (
    <div className="page-stack tv-cases-page">
      <Card
        title="Casos TeamViewer"
        subtitle="Este modulo consulta e importa conexiones/casos de TeamViewer. No reemplaza incidentes internos: funciona como registro operativo externo."
        actions={<Badge tone="primary">{rows.length} en pagina</Badge>}
      >
        <div className="tv-cases-summary">
          <div className="tv-cases-summary-block">
            <span>Busqueda actual</span>
            <strong>{hasSearched ? `${rows.length} resultados` : 'Sin consulta'}</strong>
            <small>{activeFiltersSummary}</small>
          </div>
          <div className="tv-cases-summary-block">
            <span>Rango inicial</span>
            <strong>
              {listFilters.from_date || '-'} a {listFilters.to_date || '-'}
            </strong>
            <small>Se precarga el mes actual para acelerar consulta.</small>
          </div>
        </div>
      </Card>

      <InlineError message={error} />
      <InlineSuccess message={success} />

      <div className="tv-cases-tools-grid">
        <Card title="Importar casos" subtitle="Carga un rango y refresca catalogos para que soporte trabaje con datos recientes.">
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
            <Button variant="primary" onClick={onImport} disabled={importing || loading}>
              {importing ? 'Importando...' : 'Importar rango'}
            </Button>
          </div>
        </Card>

        <Card title="Alta manual" subtitle="Registra un caso externo cuando no llega por importacion o necesita carga correctiva.">
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
              Tecnico *
              <select
                className="input"
                value={manualForm.technician_user_id}
                onChange={(event) => setManualForm((prev) => ({ ...prev, technician_user_id: event.target.value }))}
                required
              >
                <option value="">Seleccionar tecnico</option>
                {technicianOptions.map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {technician.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Grupo TeamViewer *
              <select
                className="input"
                value={manualForm.teamviewer_group_name}
                onChange={(event) => setManualForm((prev) => ({ ...prev, teamviewer_group_name: event.target.value }))}
                required
              >
                <option value="">Seleccionar grupo</option>
                {groupOptions.map((group) => (
                  <option key={group.group_name} value={group.group_name}>
                    {group.group_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="full-row">
              Comentario
              <input
                className="input"
                value={manualForm.note_raw}
                onChange={(event) => setManualForm((prev) => ({ ...prev, note_raw: event.target.value }))}
                placeholder="problema - solicitante"
                required
              />
            </label>
            {selectedManualGroup && (
              <div className="full-row">
                <small className="panel-caption">
                  Grupo: {selectedManualGroup.group_name}
                  {selectedManualGroup.location_name ? ` | Local vinculado: ${selectedManualGroup.location_name}` : ''}
                </small>
              </div>
            )}
            <div className="form-actions full-row">
              <Button
                type="submit"
                variant="primary"
                disabled={savingManual || !manualForm.technician_user_id || !manualForm.teamviewer_group_name}
              >
                {savingManual ? 'Guardando...' : 'Crear caso manual'}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {summary && (
        <Card title="Resultado de la ultima importacion" subtitle="Se muestran contadores utiles para validar calidad de entrada y descarte.">
          <div className="key-value-grid">
            <div><strong>Total recibidos:</strong> {summary.total_received}</div>
            <div><strong>Con nota:</strong> {summary.total_with_note}</div>
            <div><strong>Formato valido:</strong> {summary.total_valid_format}</div>
            <div><strong>Insertados:</strong> {summary.total_inserted}</div>
            <div><strong>Duplicados:</strong> {summary.total_duplicated}</div>
            <div><strong>Formato invalido:</strong> {summary.total_discarded_invalid_format}</div>
          </div>
        </Card>
      )}

      {discarded.length > 0 && (
        <Card title="Descartados" subtitle="Muestra acotada para revisar por que no entraron ciertos registros.">
          <DataTable
            columns={[
              { key: 'external_id', header: 'External ID' },
              { key: 'reason', header: 'Motivo' }
            ]}
            rows={discarded.slice(0, 20).map((row, index) => ({
              key: `${row.external_connection_id || 'no-id'}-${index}`,
              cells: [row.external_connection_id || '-', row.reason]
            }))}
            tableClassName="compact"
          />
        </Card>
      )}

      <Card
        title="Consulta de casos"
        subtitle="Filtros orientados a busqueda operativa: rango, tecnico, grupo, local y texto libre."
        actions={<Badge tone={hasMore ? 'warning' : 'neutral'}>{hasMore ? 'Hay mas paginas' : 'Fin de resultados'}</Badge>}
      >
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
            <select
              className="input"
              value={listFilters.technician_user_id}
              onChange={(event) => setListFilters((prev) => ({ ...prev, technician_user_id: event.target.value }))}
            >
              <option value="">Todos</option>
              {technicianOptions.map((technician) => (
                <option key={technician.id} value={technician.id}>
                  {technician.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Grupo TeamViewer
            <select
              className="input"
              value={listFilters.group}
              onChange={(event) => setListFilters((prev) => ({ ...prev, group: event.target.value }))}
            >
              <option value="">Todos</option>
              {groupOptions.map((group) => (
                <option key={group.group_name} value={group.group_name}>
                  {group.group_name}
                </option>
              ))}
            </select>
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
          <Button variant="primary" onClick={onApplyFilters} disabled={loading}>
            Buscar casos
          </Button>
          <Button variant="secondary" onClick={onResetFilters} disabled={loading}>
            Restablecer filtros
          </Button>
        </div>

        {!hasSearched ? (
          <div className="dashboard-empty-state">
            Selecciona un rango y ejecuta la busqueda para consultar casos.
          </div>
        ) : loading ? (
          <LoadingBlock label="Actualizando casos..." />
        ) : (
          <>
            <DataTable
              columns={tableColumns}
              rows={tableRows}
              emptyMessage="Sin resultados para los filtros actuales."
              tableClassName="compact"
              extraWide
            />

            <div className="form-actions">
              <Button
                variant="secondary"
                onClick={() => setPageOffset((prev) => Math.max(prev - PAGE_SIZE, 0))}
                disabled={loading || pageOffset === 0}
              >
                Pagina anterior
              </Button>
              <Button
                variant="secondary"
                onClick={() => setPageOffset((prev) => prev + PAGE_SIZE)}
                disabled={loading || !hasMore}
              >
                Pagina siguiente
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

export default TeamViewerImportedCasesPage;
