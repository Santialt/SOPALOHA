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

const TASK_STATUS_LABELS = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  blocked: 'Bloqueada',
  done: 'Resuelta',
  cancelled: 'Cancelada'
};

function formatTaskStatus(status) {
  return TASK_STATUS_LABELS[status] || status || '-';
}

function formatTaskDueDate(value) {
  if (!value) return 'Sin vencimiento';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-AR');
}

function getTaskDueTone(value) {
  if (!value) return 'neutral';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(dueDate.getTime())) return 'neutral';
  if (dueDate < today) return 'danger';
  if (dueDate.getTime() === today.getTime()) return 'warning';
  return 'neutral';
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
    taskMetrics: {
      totalTasks: 0,
      openTasks: 0,
      closedTasks: 0,
      urgentTasksPreview: [],
      urgentTasksPreviewMode: 'due_date'
    },
    incidentMetrics: {
      totalCases: 0,
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
  const taskMetrics = stats.taskMetrics || {};
  const topLocations = incidentMetrics.topLocations || [];
  const urgentTasksPreview = taskMetrics.urgentTasksPreview || [];
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
              helper="Incidentes + imported cases no vinculados"
            />
            <StatCard
              label="Tareas totales"
              value={taskMetrics.totalTasks ?? stats.tasks}
              tone="neutral"
              helper="Base total de tareas operativas"
            />
            <StatCard
              label="Tareas abiertas"
              value={taskMetrics.openTasks ?? 0}
              tone="warning"
              helper="pending + in_progress + blocked"
            />
            <StatCard
              label="Tareas cerradas"
              value={taskMetrics.closedTasks ?? 0}
              tone="success"
              helper="done + cancelled"
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
              <h2>Tareas urgentes o proximas a vencer</h2>
              <small className="panel-caption">
                Solo tareas abiertas. Si hay vencimiento definido, se muestran primero las vencidas y luego las proximas.
              </small>
            </div>
          </div>
          {urgentTasksPreview.length ? (
            <div className="dashboard-task-preview-list">
              {urgentTasksPreview.map((task) => {
                const dueTone = getTaskDueTone(task.due_date);

                return (
                  <Link key={task.id} to="/tasks" className="dashboard-task-preview-item">
                    <div className="dashboard-task-preview-head">
                      <strong>{task.title}</strong>
                      <span className={`dashboard-task-preview-due tone-${dueTone}`}>
                        {formatTaskDueDate(task.due_date)}
                      </span>
                    </div>
                    <div className="dashboard-task-preview-meta">
                      <span>{formatTaskStatus(task.status)}</span>
                      <span>{task.location_name || 'Sin local'}</span>
                      <span>{task.priority || 'medium'}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="dashboard-empty-state">No hay tareas abiertas para priorizar en el dashboard.</div>
          )}
          <div className="dashboard-brief-grid">
            <div className="dashboard-brief-card">
              <span>Ventana analitica desde</span>
              <strong>{formatWindowStart(incidentMetrics.lastMonthWindow?.since)}</strong>
              <small>Fecha base usada para rankings y clasificacion reciente.</small>
            </div>
            <div className="dashboard-brief-card">
              <span>Locales registrados</span>
              <strong>{stats.locations}</strong>
              <small>Base actual de locales disponibles en SOPALOHA.</small>
            </div>
            <div className="dashboard-brief-card">
              <span>Modo del preview</span>
              <strong>
                {taskMetrics.urgentTasksPreviewMode === 'undated' ? 'Sin fecha' : 'Por vencimiento'}
              </strong>
              <small>
                Las tareas sin `due_date` solo aparecen si no existen abiertas con vencimiento.
              </small>
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
