export function normalizeTeamviewerId(value) {
  return String(value || '').replace(/\s+/g, '');
}

export function buildTeamviewerDeepLink(teamviewerId) {
  const normalized = normalizeTeamviewerId(teamviewerId);
  if (!normalized) return null;

  return `teamviewer10://control?device=${normalized}`;
}

export function openTeamviewerOnClient(teamviewerId) {
  const deepLinkUrl = buildTeamviewerDeepLink(teamviewerId);
  if (!deepLinkUrl) {
    return {
      ok: false,
      deepLinkUrl: null,
      message: 'El equipo no tiene TeamViewer ID operativo.'
    };
  }

  const anchor = document.createElement('a');
  anchor.href = deepLinkUrl;
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  return {
    ok: true,
    deepLinkUrl,
    message:
      'Se intento abrir TeamViewer en esta PC. Si no se abre, verifica la instalacion local y usa el TV ID copiado.'
  };
}

export function describeTeamviewerPresence({ presence, rawState, hasTeamviewerId, statusAvailable }) {
  if (!hasTeamviewerId) {
    return {
      tone: 'unknown',
      label: 'Sin TV ID',
      detail: 'No hay TeamViewer ID operativo.'
    };
  }

  if (presence === 'online') {
    return {
      tone: 'online',
      label: 'Online',
      detail: rawState || 'online'
    };
  }

  if (presence === 'offline') {
    return {
      tone: 'offline',
      label: 'Offline',
      detail: rawState || 'offline'
    };
  }

  if (statusAvailable && rawState) {
    return {
      tone: 'unknown',
      label: 'Desconocido',
      detail: rawState
    };
  }

  return {
    tone: 'unknown',
    label: 'Desconocido',
    detail: 'Sin estado remoto disponible.'
  };
}
