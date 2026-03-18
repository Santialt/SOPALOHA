import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import InlineError from '../components/InlineError';
import LoadingBlock from '../components/LoadingBlock';
import { useDataLoader } from '../hooks/useDataLoader';
import { api } from '../services/api';
import {
  ALOHA_MASTER_COLUMNS,
  DEFAULT_VISIBLE_ALOHA_MASTER_COLUMNS,
  buildAlohaMasterRow,
  getAlohaMasterCellValue
} from '../utils/alohaMaster';

function AlohaMasterPage() {
  const [locations, setLocations] = useState([]);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('all');
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_ALOHA_MASTER_COLUMNS);

  const { loading, error } = useDataLoader(async () => {
    const data = await api.getLocations();
    setLocations(data);
  }, []);

  const availableColumns = useMemo(
    () => ALOHA_MASTER_COLUMNS.filter((column) => column.available),
    []
  );

  const pendingColumns = useMemo(
    () => ALOHA_MASTER_COLUMNS.filter((column) => !column.available),
    []
  );

  const countries = useMemo(() => {
    const values = [...new Set(locations.map((location) => String(location.country || '').trim()).filter(Boolean))];
    return values.sort((left, right) => left.localeCompare(right, 'es'));
  }, [locations]);

  const rows = useMemo(() => locations.map(buildAlohaMasterRow), [locations]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesCountry = country === 'all' || row.country === country;
      if (!matchesCountry) return false;

      if (!normalizedSearch) return true;

      return [
        row.name,
        row.razon_social,
        row.llave_aloha,
        row.version_aloha,
        row.version_modulo_fiscal,
        row.country,
        row.cmc
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [country, rows, search]);

  const toggleColumn = (columnId) => {
    setVisibleColumns((current) => {
      if (current.includes(columnId)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== columnId);
      }

      return [...current, columnId];
    });
  };

  if (loading) {
    return <LoadingBlock label="Cargando Aloha Master..." />;
  }

  return (
    <div className="page-stack">
      <section className="section-card">
        <div className="section-head wrap">
          <div>
            <h2>ALOHA MASTER</h2>
            <small className="panel-caption">
              Vista operativa derivada de Locales. Solo expone campos reales o derivaciones directas del modelo actual.
            </small>
          </div>

          <div className="filter-row">
            <input
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por tienda, razon social, key, version o CMC"
              aria-label="Buscar en Aloha Master"
            />
            <select
              className="input"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              aria-label="Filtrar por pais"
            >
              <option value="all">Todos los paises</option>
              {countries.map((countryValue) => (
                <option key={countryValue} value={countryValue}>
                  {countryValue}
                </option>
              ))}
            </select>
          </div>
        </div>

        <InlineError message={error} />

        <div className="aloha-master-toolbar">
          <div className="aloha-master-column-picker">
            {availableColumns.map((column) => (
              <label key={column.id} className="aloha-master-column-toggle">
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(column.id)}
                  onChange={() => toggleColumn(column.id)}
                />
                <span>{column.label}</span>
              </label>
            ))}
          </div>

          <div className="aloha-master-meta">
            <span className="dashboard-window-chip">
              {filteredRows.length} {filteredRows.length === 1 ? 'local' : 'locales'}
            </span>
            <small>
              Columnas pendientes fuera de grilla: {pendingColumns.map((column) => column.label).join(', ')}
            </small>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="table-wrap table-wrap-xl">
          <table className="table compact">
            <thead>
              <tr>
                <th>Pais</th>
                {availableColumns
                  .filter((column) => visibleColumns.includes(column.id))
                  .map((column) => (
                    <th key={column.id}>{column.label}</th>
                  ))}
                <th>Local</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.country}</td>
                  {availableColumns
                    .filter((column) => visibleColumns.includes(column.id))
                    .map((column) => (
                      <td key={column.id}>{getAlohaMasterCellValue(row, column.id)}</td>
                    ))}
                  <td>
                    <Link to={`/locations/${row.id}`} className="btn-link">
                      Ver ficha
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length + 2} className="empty-row">
                    Sin locales para los filtros actuales
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-card">
        <h3>Columnas pendientes por modelo</h3>
        <div className="chip-list">
          {pendingColumns.map((column) => (
            <span key={column.id} className="chip" title={column.pendingReason}>
              {column.label}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

export default AlohaMasterPage;
