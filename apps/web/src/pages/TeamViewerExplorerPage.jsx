import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import InlineError from '../components/InlineError';
import InlineSuccess from '../components/InlineSuccess';
import LoadingBlock from '../components/LoadingBlock';
import { api } from '../services/api';

function formatLocationStatus(status) {
  if (status === 'inactive' || status === 'cerrado') return 'cerrado';
  if (status === 'active' || status === 'abierto') return 'abierto';
  return status || 'sin datos';
}

function TeamViewerExplorerPage() {
  const [explorer, setExplorer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [runningActionKey, setRunningActionKey] = useState('');
  const teamviewerOpenLockRef = useRef(new Map());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      setSuccess('');

      try {
        const data = await api.getTeamviewerExplorer();
        setExplorer(data);
        if (data.groups.length > 0) {
          const firstGroup = data.groups[0];
          setSelected({ type: 'group', groupId: firstGroup.group_id });
          setExpandedGroups(new Set([firstGroup.group_id]));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredGroups = useMemo(() => {
    if (!explorer) return [];
    const term = search.trim().toLowerCase();
    if (!term) return explorer.groups;

    return explorer.groups
      .map((group) => {
        const groupMatches = group.group_name.toLowerCase().includes(term);
        const filteredDevices = group.devices.filter((device) => {
          const alias = String(device.alias || '').toLowerCase();
          const tvId = String(device.teamviewer_id || '').toLowerCase();
          const tvDeviceId = String(device.teamviewer_device_id || '').toLowerCase();
          return alias.includes(term) || tvId.includes(term) || tvDeviceId.includes(term);
        });

        if (!groupMatches && filteredDevices.length === 0) return null;
        return {
          ...group,
          devices: groupMatches ? group.devices : filteredDevices
        };
      })
      .filter(Boolean);
  }, [explorer, search]);

  const selectedGroup = useMemo(() => {
    if (!selected || !explorer) return null;
    if (selected.type === 'group') {
      return explorer.groups.find((group) => group.group_id === selected.groupId) || null;
    }
    return explorer.groups.find((group) => group.group_id === selected.groupId) || null;
  }, [selected, explorer]);

  const selectedDevice = useMemo(() => {
    if (!selected || selected.type !== 'device' || !selectedGroup) return null;
    return (
      selectedGroup.devices.find(
        (device) =>
          device.teamviewer_id === selected.teamviewerId ||
          device.teamviewer_device_id === selected.teamviewerId
      ) || null
    );
  }, [selected, selectedGroup]);

  const onToggleGroup = (groupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const copyToClipboard = async (value) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  };

  const onCopyTeamviewerId = async (device) => {
    if (!device?.teamviewer_id) {
      setError('El equipo no tiene TeamViewer ID operativo.');
      return;
    }

    setError('');
    setSuccess('');
    try {
      await copyToClipboard(device.teamviewer_id);
      setSuccess(`TeamViewer ID copiado: ${device.teamviewer_id}`);
    } catch (err) {
      setError('No se pudo copiar el TeamViewer ID.');
    }
  };

  const onOpenTeamviewer = async (device) => {
    if (!device?.teamviewer_id) {
      setError('El equipo no tiene TeamViewer ID operativo.');
      return;
    }

    const now = Date.now();
    const lockKey = `${device.group_id}:${device.teamviewer_id}`;
    const lastOpenAt = teamviewerOpenLockRef.current.get(lockKey) || 0;
    if (now - lastOpenAt < 3000) {
      setError('');
      setSuccess('Apertura ya solicitada hace unos segundos. Espera un momento.');
      return;
    }

    teamviewerOpenLockRef.current.set(lockKey, now);
    const actionKey = `tv-${lockKey}`;
    setRunningActionKey(actionKey);
    setError('');
    setSuccess('');

    try {
      const result = await api.openTeamviewer(device.teamviewer_id);
      if (result.skipped) {
        setSuccess('Apertura omitida para evitar doble ejecucion.');
      } else {
        setSuccess(`TeamViewer lanzado por backend (${result.method}).`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRunningActionKey('');
    }
  };

  if (loading) return <LoadingBlock label="Cargando TeamViewer Explorer..." />;

  if (!explorer) {
    return <InlineError message={error || 'No se pudo cargar TeamViewer Explorer.'} />;
  }

  const locationForDetails = selectedDevice?.linked_location || selectedGroup?.linked_location || null;
  const hasLocation = Boolean(locationForDetails?.id);
  const linkedDevice = selectedDevice?.linked_device || null;
  const incidentQuery = selectedDevice
    ? `/incidents?location_id=${selectedDevice.location_id || ''}${
        linkedDevice?.id ? `&device_id=${linkedDevice.id}` : ''
      }`
    : selectedGroup?.location_id
      ? `/incidents?location_id=${selectedGroup.location_id}`
      : '/incidents';

  return (
    <div className="teamviewer-explorer-page">
      <div className="teamviewer-explorer-messages">
        <InlineError message={error} />
        <InlineSuccess message={success} />
      </div>

      <section className="section-card">
        <div className="section-head">
          <h2>TeamViewer Explorer</h2>
          <div className="key-value-inline">
            <small>Grupos: {explorer.summary.groups_total}</small>
            <small>Equipos: {explorer.summary.devices_total}</small>
          </div>
        </div>
        <div className="filter-row">
          <input
            className="input"
            placeholder="Buscar por grupo, alias o TeamViewer ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </section>

      <section className="teamviewer-explorer-layout">
        <div className="section-card explorer-tree">
          {filteredGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.group_id);
            const isSelectedGroup = selected?.type === 'group' && selected.groupId === group.group_id;

            return (
              <div key={group.group_id} className="explorer-group-block">
                <div className={`explorer-group-row ${isSelectedGroup ? 'selected' : ''}`}>
                  <button
                    type="button"
                    className="btn-small"
                    onClick={() => onToggleGroup(group.group_id)}
                    aria-label={isExpanded ? 'Contraer grupo' : 'Expandir grupo'}
                  >
                    {isExpanded ? '-' : '+'}
                  </button>
                  <button
                    type="button"
                    className="explorer-group-select"
                    onClick={() => setSelected({ type: 'group', groupId: group.group_id })}
                  >
                    <strong>{group.group_name}</strong>
                    <small>
                      {group.device_count} equipos | {group.location_name || 'sin location'}
                    </small>
                  </button>
                </div>

                {isExpanded && (
                  <ul className="explorer-device-list">
                    {group.devices.map((device) => {
                      const uniqueDeviceId = device.teamviewer_id || device.teamviewer_device_id || device.alias;
                      const isSelectedDevice =
                        selected?.type === 'device' &&
                        selected.groupId === group.group_id &&
                        selected.teamviewerId === uniqueDeviceId;

                      return (
                        <li key={`${group.group_id}-${uniqueDeviceId}`}>
                          <button
                            type="button"
                            className={`explorer-device-row ${isSelectedDevice ? 'selected' : ''}`}
                            onClick={() =>
                              setSelected({
                                type: 'device',
                                groupId: group.group_id,
                                teamviewerId: uniqueDeviceId
                              })
                            }
                          >
                            <span>{device.alias}</span>
                            <small>{device.teamviewer_id || device.teamviewer_device_id || 'sin id'}</small>
                          </button>
                        </li>
                      );
                    })}
                    {group.devices.length === 0 && <li className="empty-row">Sin equipos en este filtro.</li>}
                  </ul>
                )}
              </div>
            );
          })}
          {filteredGroups.length === 0 && <div className="empty-row">Sin resultados para el filtro actual.</div>}
        </div>

        <div className="section-card explorer-detail">
          {!selectedGroup && <div className="empty-row">Selecciona un grupo o equipo.</div>}

          {selectedGroup && !selectedDevice && (
            <div>
              <h3>{selectedGroup.group_name}</h3>
              <div className="key-value-grid">
                <div><strong>Group ID:</strong> {selectedGroup.group_id}</div>
                <div><strong>Cantidad equipos:</strong> {selectedGroup.device_count}</div>
                <div><strong>Location asociado:</strong> {selectedGroup.location_name || 'sin match'}</div>
              </div>

              <h3>Ficha del local</h3>
              <div className="key-value-grid">
                <div><strong>name:</strong> {locationForDetails?.name || 'sin datos'}</div>
                <div><strong>company_name:</strong> {locationForDetails?.company_name || 'sin datos'}</div>
                <div><strong>razon_social:</strong> {locationForDetails?.razon_social || 'sin datos'}</div>
                <div><strong>cuit:</strong> {locationForDetails?.cuit || 'sin datos'}</div>
                <div><strong>llave_aloha:</strong> {locationForDetails?.llave_aloha || 'sin datos'}</div>
                <div><strong>version_aloha:</strong> {locationForDetails?.version_aloha || 'sin datos'}</div>
                <div>
                  <strong>version_modulo_fiscal:</strong>{' '}
                  {locationForDetails?.version_modulo_fiscal || 'sin datos'}
                </div>
                <div><strong>usa_nbo:</strong> {locationForDetails ? (locationForDetails.usa_nbo ? 'si' : 'no') : 'sin datos'}</div>
                <div><strong>address:</strong> {locationForDetails?.address || 'sin datos'}</div>
                <div><strong>city:</strong> {locationForDetails?.city || 'sin datos'}</div>
                <div><strong>phone:</strong> {locationForDetails?.phone || 'sin datos'}</div>
                <div><strong>status:</strong> {formatLocationStatus(locationForDetails?.status)}</div>
              </div>

              <div className="form-actions">
                {hasLocation ? (
                  <Link to={`/locations/${locationForDetails.id}`} className="btn-link">
                    Ver ficha del local
                  </Link>
                ) : (
                  <button type="button" className="btn-secondary" disabled>
                    Sin local vinculado
                  </button>
                )}
                <Link to="/teamviewer-import" className="btn-secondary">
                  Importar / sincronizar grupo
                </Link>
                <Link to={incidentQuery} className="btn-link">
                  Registrar incidente
                </Link>
              </div>
            </div>
          )}

          {selectedGroup && selectedDevice && (
            <div>
              <h3>{selectedDevice.alias}</h3>
              <div className="key-value-grid">
                <div><strong>TeamViewer ID:</strong> {selectedDevice.teamviewer_id || 'sin datos'}</div>
                <div><strong>Estado:</strong> {selectedDevice.status || 'sin datos'}</div>
                <div><strong>Grupo:</strong> {selectedDevice.group_name}</div>
                <div><strong>Location asociado:</strong> {selectedDevice.location_name || 'sin match'}</div>
                <div><strong>device_role detectado:</strong> {selectedDevice.role_detected || 'other'}</div>
                <div><strong>Origen:</strong> {selectedDevice.source_status}</div>
              </div>

              <h3>Ficha de device (SQLite)</h3>
              <div className="key-value-grid">
                <div><strong>name:</strong> {linkedDevice?.name || 'sin datos'}</div>
                <div><strong>device_role:</strong> {linkedDevice?.device_role || 'sin datos'}</div>
                <div><strong>ip_address:</strong> {linkedDevice?.ip_address || 'sin datos'}</div>
                <div><strong>windows_version:</strong> {linkedDevice?.windows_version || 'sin datos'}</div>
                <div><strong>ram_gb:</strong> {linkedDevice?.ram_gb ?? 'sin datos'}</div>
                <div><strong>cpu:</strong> {linkedDevice?.cpu || 'sin datos'}</div>
                <div><strong>disk_type:</strong> {linkedDevice?.disk_type || 'sin datos'}</div>
                <div><strong>notes:</strong> {linkedDevice?.notes || 'sin datos'}</div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => onOpenTeamviewer(selectedDevice)}
                  disabled={
                    runningActionKey === `tv-${selectedDevice.group_id}:${selectedDevice.teamviewer_id}` ||
                    !selectedDevice.teamviewer_id
                  }
                >
                  {runningActionKey === `tv-${selectedDevice.group_id}:${selectedDevice.teamviewer_id}`
                    ? 'Abriendo...'
                    : 'Abrir TeamViewer'}
                </button>
                <button type="button" className="btn-small" onClick={() => onCopyTeamviewerId(selectedDevice)}>
                  Copiar TeamViewer ID
                </button>
                <Link to={incidentQuery} className="btn-link">
                  Registrar incidente
                </Link>
                {hasLocation ? (
                  <Link to={`/locations/${locationForDetails.id}`} className="btn-link">
                    Ver ficha del local
                  </Link>
                ) : (
                  <button type="button" className="btn-secondary" disabled>
                    Sin local vinculado
                  </button>
                )}
                {linkedDevice?.id && linkedDevice?.location_id ? (
                  <Link to={`/locations/${linkedDevice.location_id}?device_id=${linkedDevice.id}`} className="btn-link">
                    Ver ficha del device
                  </Link>
                ) : (
                  <button type="button" className="btn-secondary" disabled>
                    Device no importado
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default TeamViewerExplorerPage;
