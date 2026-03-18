import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import InlineError from '../components/InlineError';
import InlineSuccess from '../components/InlineSuccess';
import LoadingBlock from '../components/LoadingBlock';
import { api } from '../services/api';
import { openTeamviewerOnClient } from '../utils/teamviewer';

function formatLocationStatus(status) {
  if (status === 'inactive' || status === 'cerrado') return 'cerrado';
  if (status === 'active' || status === 'abierto') return 'abierto';
  return status || 'sin datos';
}

function formatRemoteStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'online') return 'En linea';
  if (normalized === 'offline') return 'Sin conexion';
  return status || 'Sin datos';
}

function formatMatchStatus(sourceStatus) {
  if (sourceStatus === 'linked') return 'Vinculado en SOPALOHA';
  if (sourceStatus === 'pending_import') return 'Local detectado, equipo pendiente de importar';
  if (sourceStatus === 'teamviewer_only') return 'Solo en TeamViewer';
  return sourceStatus || 'Sin datos';
}

function formatDeviceRole(role) {
  if (role === 'server') return 'Servidor';
  if (role === 'pos') return 'Caja / POS';
  if (role === 'other') return 'Otro equipo';
  return role || 'Sin datos';
}

function formatBusinessBoolean(value) {
  return value ? 'Si' : 'No';
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return 'Sin datos';
  return value;
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
      const result = openTeamviewerOnClient(device.teamviewer_id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(
        'Se intento abrir TeamViewer en esta PC usando el deep link local. Si no se abre, verifica TeamViewer instalado y usa el ID copiado.'
      );
    } catch (err) {
      setError('No se pudo solicitar la apertura local de TeamViewer.');
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
  const incidentQuery = (() => {
    const params = new URLSearchParams();
    const groupId = selectedGroup?.group_id || '';

    if (groupId) {
      params.set('teamviewer_group_id', groupId);
    }

    if (selectedDevice?.location_id) {
      params.set('location_id', String(selectedDevice.location_id));
    } else if (selectedGroup?.location_id) {
      params.set('location_id', String(selectedGroup.location_id));
    }

    if (linkedDevice?.id) {
      params.set('device_id', String(linkedDevice.id));
    }

    const queryString = params.toString();
    return queryString ? `/incidents?${queryString}` : '/incidents';
  })();

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
            <small>Locales vinculados: {explorer.summary.groups_linked_to_locations}</small>
            <small>Equipos vinculados: {explorer.summary.devices_linked_to_sopaloha}</small>
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
                      {group.device_count} equipos | {group.location_name || 'sin local vinculado'}
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
                <div><strong>ID de grupo:</strong> {selectedGroup.group_id}</div>
                <div><strong>Equipos en el grupo:</strong> {selectedGroup.device_count}</div>
                <div><strong>Estado de vinculacion:</strong> {formatMatchStatus(selectedGroup.source_status)}</div>
                <div><strong>Local vinculado:</strong> {selectedGroup.location_name || 'Sin match'}</div>
              </div>

              <h3>Resumen operativo del local</h3>
              <div className="key-value-grid">
                <div><strong>Local:</strong> {formatValue(locationForDetails?.name)}</div>
                <div><strong>Empresa:</strong> {formatValue(locationForDetails?.company_name)}</div>
                <div><strong>Razon social:</strong> {formatValue(locationForDetails?.razon_social)}</div>
                <div><strong>CUIT:</strong> {formatValue(locationForDetails?.cuit)}</div>
                <div><strong>Direccion:</strong> {formatValue(locationForDetails?.address)}</div>
                <div><strong>Ciudad:</strong> {formatValue(locationForDetails?.city)}</div>
                <div><strong>Telefono:</strong> {formatValue(locationForDetails?.phone)}</div>
                <div><strong>Estado del local:</strong> {formatLocationStatus(locationForDetails?.status)}</div>
                <div><strong>Usa NBO:</strong> {locationForDetails ? formatBusinessBoolean(locationForDetails.usa_nbo) : 'Sin datos'}</div>
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
                <div><strong>TeamViewer ID:</strong> {formatValue(selectedDevice.teamviewer_id)}</div>
                <div><strong>Estado remoto:</strong> {formatRemoteStatus(selectedDevice.status)}</div>
                <div><strong>Grupo:</strong> {selectedDevice.group_name}</div>
                <div><strong>Local vinculado:</strong> {selectedDevice.location_name || 'Sin match'}</div>
                <div><strong>Tipo estimado:</strong> {formatDeviceRole(selectedDevice.role_detected)}</div>
                <div><strong>Estado de importacion:</strong> {formatMatchStatus(selectedDevice.source_status)}</div>
              </div>

              <h3>Equipo vinculado en SOPALOHA</h3>
              <div className="key-value-grid">
                <div><strong>Nombre interno:</strong> {formatValue(linkedDevice?.name)}</div>
                <div><strong>Tipo de equipo:</strong> {formatValue(linkedDevice?.device_role)}</div>
                <div><strong>IP:</strong> {formatValue(linkedDevice?.ip_address)}</div>
                <div><strong>Windows:</strong> {formatValue(linkedDevice?.windows_version)}</div>
                <div><strong>Memoria RAM:</strong> {linkedDevice?.ram_gb ?? 'Sin datos'}</div>
                <div><strong>Procesador:</strong> {formatValue(linkedDevice?.cpu)}</div>
                <div><strong>Almacenamiento:</strong> {formatValue(linkedDevice?.disk_type)}</div>
                <div><strong>Notas:</strong> {formatValue(linkedDevice?.notes)}</div>
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
                    : 'Abrir en esta PC'}
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
