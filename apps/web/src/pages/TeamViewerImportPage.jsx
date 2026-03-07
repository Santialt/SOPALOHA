import { useState } from 'react';
import InlineError from '../components/InlineError';
import InlineSuccess from '../components/InlineSuccess';
import { api } from '../services/api';

function TeamViewerImportPage() {
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [importResult, setImportResult] = useState(null);

  const loadPreview = async () => {
    setLoadingPreview(true);
    setError('');
    setSuccess('');

    try {
      const data = await api.getTeamviewerImportPreview();
      setPreview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const confirmImport = async () => {
    setImporting(true);
    setError('');
    setSuccess('');

    try {
      const data = await api.runTeamviewerImport();
      await loadPreview();
      setImportResult(data);
      setSuccess('Importacion completada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <section className="section-card">
        <h2>Acciones</h2>
        <div className="form-actions">
          <button className="btn-primary" onClick={loadPreview} disabled={loadingPreview}>
            {loadingPreview ? 'Cargando...' : 'Cargar vista previa'}
          </button>
          <button
            className="btn-secondary"
            onClick={confirmImport}
            disabled={!preview || importing || loadingPreview}
          >
            {importing ? 'Importando...' : 'Confirmar importacion'}
          </button>
        </div>
      </section>

      <InlineError message={error} />
      <InlineSuccess message={success} />

      {preview && (
        <section className="section-card">
          <h2>Resumen de vista previa</h2>
          <div className="key-value-grid">
            <div><strong>Grupos TeamViewer:</strong> {preview.summary.groups_total}</div>
            <div><strong>Devices TeamViewer:</strong> {preview.summary.devices_total}</div>
            <div><strong>Locations a crear:</strong> {preview.summary.locations_to_create}</div>
            <div><strong>Locations reutilizados:</strong> {preview.summary.locations_to_reuse}</div>
            <div><strong>Devices a crear:</strong> {preview.summary.devices_to_create}</div>
            <div><strong>Devices duplicados:</strong> {preview.summary.devices_duplicates}</div>
          </div>
          {preview.warnings?.length > 0 && (
            <ul>
              {preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {preview && (
        <section className="section-card">
          <h2>Grupos TeamViewer a Locations</h2>
          <table className="table compact">
            <thead>
              <tr>
                <th>Group ID</th>
                <th>Grupo TeamViewer</th>
                <th>Location destino</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {preview.groups.map((row) => (
                <tr key={row.group_id}>
                  <td>{row.group_id}</td>
                  <td>{row.group_name}</td>
                  <td>{row.location_name}</td>
                  <td><span className={`badge ${row.location_status}`}>{row.location_status}</span></td>
                </tr>
              ))}
              {preview.groups.length === 0 && (
                <tr>
                  <td colSpan="4" className="empty-row">Sin grupos</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {preview && (
        <section className="section-card">
          <h2>Devices</h2>
          <table className="table compact">
            <thead>
              <tr>
                <th>Grupo TeamViewer</th>
                <th>Location destino</th>
                <th>Alias</th>
                <th>teamviewer_id</th>
                <th>Fuente ID</th>
                <th>Role detectado</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {preview.devices.map((row, index) => (
                <tr key={`${row.alias}-${row.teamviewer_id || 'none'}-${index}`}>
                  <td>{row.group_name}</td>
                  <td>{row.location_name}</td>
                  <td>{row.alias}</td>
                  <td>{row.teamviewer_id || '-'}</td>
                  <td>{row.teamviewer_id_source}</td>
                  <td>{row.role}</td>
                  <td><span className={`badge ${row.status}`}>{row.status}</span></td>
                </tr>
              ))}
              {preview.devices.length === 0 && (
                <tr>
                  <td colSpan="7" className="empty-row">Sin devices</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {importResult && (
        <section className="section-card">
          <h2>Resultado de importacion</h2>
          <div className="key-value-grid">
            <div><strong>Locations creados:</strong> {importResult.summary.locations_created}</div>
            <div><strong>Locations reutilizados:</strong> {importResult.summary.locations_reused}</div>
            <div><strong>Devices creados:</strong> {importResult.summary.devices_created}</div>
            <div><strong>Devices omitidos:</strong> {importResult.summary.devices_skipped_duplicate}</div>
            <div><strong>Warnings:</strong> {importResult.summary.warnings}</div>
          </div>
          {importResult.warnings?.length > 0 && (
            <ul>
              {importResult.warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

export default TeamViewerImportPage;
