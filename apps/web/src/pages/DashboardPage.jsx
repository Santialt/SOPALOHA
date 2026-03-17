import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CurrentOnCallBlock from '../components/CurrentOnCallBlock';
import InlineError from '../components/InlineError';
import LoadingBlock from '../components/LoadingBlock';
import StatCard from '../components/StatCard';
import { api } from '../services/api';

const CATEGORY_LABELS = {
  network: 'Red',
  sql: 'SQL',
  aloha: 'Aloha',
  printer: 'Impresion',
  fiscal: 'Fiscal',
  hardware: 'Hardware',
  other: 'Otros'
};

function formatCategory(category) {
  return CATEGORY_LABELS[category] || category || 'Sin categoria';
}

function formatWindowStart(value) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-AR');
}

function HorizontalBarChart({ items, valueKey, labelKey, emptyLabel }) {
  const maxValue = items.reduce((highest, item) => Math.max(highest, Number(item[valueKey] || 0)), 0);

  if (!items.length) {
    return <div className="dashboard-empty-state">{emptyLabel}</div>;
  }

  return (
    <div className="dashboard-bar-chart" role="list">
      {items.map((item) => {
        const value = Number(item[valueKey] || 0);
        const width = maxValue > 0 ? `${Math.max((value / maxValue) * 100, 6)}%` : '0%';

        return (
          <div className="dashboard-bar-row" role="listitem" key={`${item[labelKey]}-${value}`}>
            <div className="dashboard-bar-head">
              <strong>{item[labelKey]}</strong>
              <span>{value}</span>
            </div>
            <div className="dashboard-bar-track" aria-hidden="true">
              <div className="dashboard-bar-fill" style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onCallError, setOnCallError] = useState('');
  const [stats, setStats] = useState({
    locations: 0,
    incidents: 0,
    tasks: 0,
    incidentMetrics: {
      totalCases: 0,
      resolvedCases: 0,
      inProgressCases: 0,
      lastMonthWindow: { days: 30, since: '' },
      topLocations: [],
      categoryBreakdown: [],
      mostFrequentCategory: null
    }
  });
  const [currentShift, setCurrentShift] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const [summary, currentOnCall] = await Promise.all([
          api.getDashboardSummary(),
          api.getCurrentOnCallShift().catch((err) => {
            setOnCallError(err.message || 'No se pudo cargar la guardia actual');
            return null;
          })
        ]);

        setStats(summary);
        setCurrentShift(currentOnCall);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) return <LoadingBlock label="Cargando dashboard..." />;

  const incidentMetrics = stats.incidentMetrics || {};
  const topLocations = incidentMetrics.topLocations || [];
  const categoryBreakdown = (incidentMetrics.categoryBreakdown || []).map((item) => ({
    ...item,
    label: formatCategory(item.category)
  }));
  const mostFrequentCategory = incidentMetrics.mostFrequentCategory;
  const totalMonthlyCategorizedCases = categoryBreakdown.reduce(
    (sum, item) => sum + Number(item.incident_count || 0),
    0
  );
  const mostFrequentCategoryShare =
    mostFrequentCategory && totalMonthlyCategorizedCases > 0
      ? Math.round((mostFrequentCategory.incidentCount / totalMonthlyCategorizedCases) * 100)
      : 0;

  return (
    <div className="page-stack">
      <InlineError message={error} />

      <section className="dashboard-hero section-card">
        <div className="dashboard-hero-copy">
          <div className="section-head wrap">
            <div>
              <h2>Resumen operativo</h2>
              <small className="panel-caption">
                KPI generales arriba y analitica reciente abajo para abrir la jornada sin revisar varias pantallas.
              </small>
            </div>
          </div>
          <div className="card-grid dashboard-kpi-grid">
            <StatCard
              label="Casos totales"
              value={incidentMetrics.totalCases ?? stats.incidents}
              tone="primary"
              helper="Base total de incidentes registrados"
            />
            <StatCard
              label="Casos cerrados totales"
              value={incidentMetrics.resolvedCases ?? 0}
              tone="success"
              helper="Total historico con estado cerrado"
            />
            <StatCard
              label="Casos abiertos actuales"
              value={incidentMetrics.inProgressCases ?? 0}
              tone="warning"
              helper="Total actual con estado activo"
            />
            <StatCard
              label="Locales registrados"
              value={stats.locations}
              tone="neutral"
              helper="Locales registrados"
              accent={`${stats.tasks} tareas operativas totales`}
            />
          </div>
        </div>

        <div className="dashboard-focus-card">
          <div className="dashboard-focus-eyebrow">Tipo mas repetido del ultimo mes</div>
          <strong className="dashboard-focus-value">
            {mostFrequentCategory ? formatCategory(mostFrequentCategory.category) : 'Sin datos'}
          </strong>
          <div className="dashboard-focus-meta">
            {mostFrequentCategory
              ? `${mostFrequentCategory.incidentCount} casos (${mostFrequentCategoryShare}% del periodo)`
              : 'Todavia no hay incidentes en la ventana analizada'}
          </div>
          <HorizontalBarChart
            items={categoryBreakdown}
            valueKey="incident_count"
            labelKey="label"
            emptyLabel="Sin incidentes recientes para clasificar."
          />
        </div>
      </section>

      <section className="dashboard-analytics-grid">
        <article className="section-card">
          <div className="section-head">
            <div>
              <h2>Locales con mas incidentes</h2>
              <small className="panel-caption">
                Ranking por incidentes creados en los ultimos {incidentMetrics.lastMonthWindow?.days || 30} dias
              </small>
            </div>
            <div className="dashboard-window-chip">
              Ventana analitica: ultimos {incidentMetrics.lastMonthWindow?.days || 30} dias
            </div>
          </div>
          <HorizontalBarChart
            items={topLocations}
            valueKey="incident_count"
            labelKey="location_name"
            emptyLabel="No hay incidentes recientes asociados a locales."
          />
        </article>

        <article className="section-card">
          <div className="section-head">
            <div>
              <h2>Lectura rapida</h2>
              <small className="panel-caption">Contexto operativo sin duplicar KPIs principales</small>
            </div>
          </div>
          <div className="dashboard-brief-grid">
            <div className="dashboard-brief-card">
              <span>Ventana analitica desde</span>
              <strong>{formatWindowStart(incidentMetrics.lastMonthWindow?.since)}</strong>
              <small>Fecha base usada para rankings y clasificacion reciente.</small>
            </div>
            <div className="dashboard-brief-card">
              <span>Estado activo usado</span>
              <strong>{incidentMetrics.activeStatusKey || 'open'}</strong>
              <small>Referencia tecnica para interpretar los casos en progreso.</small>
            </div>
            <div className="dashboard-brief-card">
              <span>Clasificacion disponible</span>
              <strong>category</strong>
              <small>Se usa para detectar volumen y repeticion por tipo de incidente.</small>
            </div>
          </div>
        </article>
      </section>

      <CurrentOnCallBlock shift={currentShift} error={onCallError} />

      <section className="section-card">
        <div className="section-head">
          <h2>Accesos rapidos</h2>
          <small className="panel-caption">Flujos operativos frecuentes</small>
        </div>
        <div className="quick-links">
          <Link to="/locations" className="btn-link">Ver locales</Link>
          <Link to="/incidents" className="btn-link">Ver casos TeamViewer</Link>
          <Link to="/tasks" className="btn-link">Gestionar tareas</Link>
          <Link to="/on-call" className="btn-link">Ver guardia actual</Link>
          <Link to="/teamviewer-explorer" className="btn-link">TeamViewer Explorer</Link>
          <Link to="/teamviewer-import" className="btn-link">Importar TeamViewer</Link>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
