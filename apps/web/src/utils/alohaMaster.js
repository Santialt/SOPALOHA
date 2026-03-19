const INTEGRATION_COLUMN_PATTERNS = {
  loyalty: ['loyalty'],
  aks: ['aks'],
  agm: ['agm'],
  ato: ['ato'],
  am: ['am'],
  cfc: ['cfc']
};

export const ALOHA_MASTER_COLUMNS = [
  { id: 'name', label: 'Nombre de la tienda', available: true },
  { id: 'fecha_apertura', label: 'Apertura', available: true },
  { id: 'razon_social', label: 'Razon social', available: true },
  { id: 'llave_aloha', label: 'Key', available: true },
  { id: 'ts_qs', label: 'TS/QS', available: false, pendingReason: 'Sin campo real en locations ni derivacion confiable actual.' },
  { id: 'version_aloha', label: 'VS Aloha', available: true },
  { id: 'idioma_pos', label: 'Idioma POS', available: false, pendingReason: 'No existe un campo de idioma POS en el modelo actual.' },
  { id: 'version_modulo_fiscal', label: 'VS Fiscal', available: true },
  { id: 'usa_nbo', label: 'NBO', available: true },
  { id: 'pulse', label: 'Pulse', available: true },
  { id: 'insight', label: 'Insight', available: true },
  { id: 'loyalty', label: 'Loyalty', available: true, derived: true },
  { id: 'aks', label: 'AKS', available: true, derived: true },
  { id: 'agm', label: 'AGM', available: true, derived: true },
  { id: 'ato', label: 'ATO', available: true, derived: true },
  { id: 'am', label: 'AM', available: true, derived: true },
  { id: 'cfc', label: 'CFC', available: true, derived: true },
  { id: 'cmc', label: 'CMC', available: true },
  { id: 'terminales', label: 'Terminales', available: true, derived: true }
];

export const DEFAULT_VISIBLE_ALOHA_MASTER_COLUMNS = ALOHA_MASTER_COLUMNS.filter(
  (column) => column.available
).map((column) => column.id);

function normalizeIntegrationName(value) {
  return String(value || '').trim().toLowerCase();
}

function hasIntegration(integrations, columnId) {
  const patterns = INTEGRATION_COLUMN_PATTERNS[columnId] || [];
  if (patterns.length === 0) return null;

  const normalized = integrations.map(normalizeIntegrationName);
  return normalized.some((integration) => patterns.some((pattern) => integration === pattern));
}

function formatBooleanFlag(value) {
  return value ? 'Si' : '-';
}

function formatText(value) {
  return value ? String(value) : '-';
}

export function buildAlohaMasterRow(location) {
  const integrations = Array.isArray(location.integrations) ? location.integrations : [];

  return {
    ...location,
    pulse: formatBooleanFlag(location.usa_insight_pulse),
    insight: formatBooleanFlag(location.usa_insight_pulse),
    usa_nbo: formatBooleanFlag(location.usa_nbo),
    loyalty: formatBooleanFlag(hasIntegration(integrations, 'loyalty')),
    aks: formatBooleanFlag(hasIntegration(integrations, 'aks')),
    agm: formatBooleanFlag(hasIntegration(integrations, 'agm')),
    ato: formatBooleanFlag(hasIntegration(integrations, 'ato')),
    am: formatBooleanFlag(hasIntegration(integrations, 'am')),
    cfc: formatBooleanFlag(hasIntegration(integrations, 'cfc')),
    terminales: Number(location.terminales) || 0,
    country: formatText(location.country)
  };
}

export function getAlohaMasterCellValue(row, columnId) {
  switch (columnId) {
    case 'name':
    case 'fecha_apertura':
    case 'razon_social':
    case 'llave_aloha':
    case 'version_aloha':
    case 'version_modulo_fiscal':
    case 'cmc':
      return formatText(row[columnId]);
    case 'terminales':
      return row.terminales;
    default:
      return formatText(row[columnId]);
  }
}
