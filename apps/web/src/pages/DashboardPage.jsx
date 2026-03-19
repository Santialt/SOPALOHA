import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';
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

const TASK_STATUS_LABELS = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  blocked: 'Bloqueada',
  done: 'Resuelta',
  cancelled: 'Cancelada'
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

function formatTaskStatus(status) {
  return TASK_STATUS_LABELS[status] || status || '-';
}

function formatTaskDueDate(value) {
  if (!value) return 'Sin fecha';
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
  return 'primary';
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
        const width = maxValue > 0 ? `${Math.max((value / maxValue) * 100, 8)}%` : '0%';

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

  const incidentMetrics = stats.incidentMetrics || {};
  const taskMetrics = stats.taskMetrics || {};
  const topLocations = incidentMetrics.topLocations || [];
  const urgentTasksPreview = taskMetrics.urgentTasksPreview || [];
  const categoryBreakdown = useMemo(
    () =>
      (incidentMetrics.categoryBreakdown || []).map((item) => ({
        ...item,
        label: formatCategory(item.category)
      })),
    [incidentMetrics.categoryBreakdown]
  );

  if (loading) return <LoadingBlock label="Cargando dashboard..." />;

  return (
    <div className="page-stack dashboard-page">
      <InlineError message={error} />

      <Card
        className="dashboard-priority-card"
        title="Que requiere atencion ahora"
        subtitle="El dashboard prioriza tareas vencidas, trabajo abierto y acceso inmediato a los flujos operativos."
        actions={
          <>
            <Button as={Link} to="/tasks" variant="primary">
              Ver tareas abiertas
            </Button>
            <Button as={Link} to="/incidents" variant="secondary">
              Abrir casos TeamViewer
            </Button>
          </>
        }
      >
        <div className="dashboard-priority-grid">
          <div className="dashboard-priority-copy">
            <div className="card-grid dashboard-kpi-grid">
              <StatCard
                label="Tareas abiertas"
                value={taskMetrics.openTasks ?? 0}
                tone="warning"
                helper="Pendientes, en progreso y bloqueadas."
              />
              <StatCard
                label="Casos TeamViewer"
                value={incidentMetrics.totalCases ?? stats.incidents}
                tone="primary"
                helper="Casos importados consultables desde soporte."
              />
              <StatCard
                label="Locales activos"
                value={stats.locations}
                tone="neutral"
                helper="Base actual para soporte operativo."
              />
              <StatCard
                label="Tareas cerradas"
                value={taskMetrics.closedTasks ?? 0}
                tone="success"
                helper="Resueltas o canceladas."
              />
            </div>
          </div>

          <div className="dashboard-priority-panel">
            <div className="dashboard-panel-header">
              <div>
                <h3>Cola de atencion</h3>
                <p>Vista corta de lo que conviene resolver primero.</p>
              </div>
              <Badge tone={urgentTasksPreview.length ? 'warning' : 'neutral'}>
                {urgentTasksPreview.length} visibles
              </Badge>
            </div>

            {urgentTasksPreview.length ? (
              <div className="dashboard-task-preview-list">
                {urgentTasksPreview.map((task) => (
                  <Link key={task.id} to="/tasks" className="dashboard-task-preview-item">
                    <div className="dashboard-task-preview-head">
                      <strong>{task.title}</strong>
                      <Badge tone={getTaskDueTone(task.due_date)}>
                        {formatTaskDueDate(task.due_date)}
                      </Badge>
                    </div>
                    <div className="dashboard-task-preview-meta">
                      <span>{formatTaskStatus(task.status)}</span>
                      <span>{task.location_name || 'Sin local'}</span>
                      <span>{task.priority || 'medium'}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty-state">
                No hay tareas urgentes cargadas en este momento.
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="dashboard-secondary-grid">
        <CurrentOnCallBlock shift={currentShift} error={onCallError} />

        <Card
          title="Atajos operativos"
          subtitle="Acciones de uso frecuente sin pasar por navegacion secundaria."
        >
          <div className="dashboard-actions-grid">
            <Button as={Link} to="/locations" variant="secondary">
              Locales
            </Button>
            <Button as={Link} to="/tasks" variant="secondary">
              Tareas
            </Button>
            <Button as={Link} to="/incidents" variant="secondary">
              Casos TV
            </Button>
            <Button as={Link} to="/teamviewer-explorer" variant="secondary">
              Explorer
            </Button>
            <Button as={Link} to="/teamviewer-import" variant="secondary">
              Importar TV
            </Button>
            <Button as={Link} to="/on-call" variant="secondary">
              Guardias
            </Button>
          </div>
        </Card>
      </div>

      <div className="dashboard-analytics-grid">
        <Card
          title="Locales con mas casos"
          subtitle={`Casos creados en los ultimos ${incidentMetrics.lastMonthWindow?.days || 30} dias.`}
          actions={
            <Badge tone="primary">
              Desde {formatWindowStart(incidentMetrics.lastMonthWindow?.since)}
            </Badge>
          }
        >
          <HorizontalBarChart
            items={topLocations}
            valueKey="incident_count"
            labelKey="location_name"
            emptyLabel="No hay casos recientes asociados a locales."
          />
        </Card>

        <Card
          title="Distribucion por categoria"
          subtitle="Analitica secundaria para detectar repeticion, no para conducir la jornada."
        >
          <HorizontalBarChart
            items={categoryBreakdown}
            valueKey="incident_count"
            labelKey="label"
            emptyLabel="Sin casos recientes para clasificar."
          />
        </Card>
      </div>
    </div>
  );
}

export default DashboardPage;
