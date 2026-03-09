import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CurrentOnCallBlock from '../components/CurrentOnCallBlock';
import InlineError from '../components/InlineError';
import LoadingBlock from '../components/LoadingBlock';
import StatCard from '../components/StatCard';
import { api } from '../services/api';

function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onCallError, setOnCallError] = useState('');
  const [stats, setStats] = useState({ locations: 0, incidents: 0, tasks: 0 });
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

  return (
    <div>
      <InlineError message={error} />

      <div className="card-grid">
        <StatCard label="Locales" value={stats.locations} tone="primary" />
        <StatCard label="Incidentes" value={stats.incidents} tone="warning" />
        <StatCard label="Tareas" value={stats.tasks} tone="neutral" />
      </div>

      <CurrentOnCallBlock shift={currentShift} error={onCallError} />

      <section className="section-card">
        <div className="section-head">
          <h2>Accesos rapidos</h2>
          <small className="panel-caption">Flujos operativos frecuentes</small>
        </div>
        <div className="quick-links">
          <Link to="/locations" className="btn-link">Ver locales</Link>
          <Link to="/incidents" className="btn-link">Gestionar incidentes</Link>
          <Link to="/tasks" className="btn-link">Gestionar tareas</Link>
          <Link to="/on-call" className="btn-link">Gestionar guardias</Link>
          <Link to="/location-notes" className="btn-link">Notas tecnicas</Link>
          <Link to="/teamviewer-explorer" className="btn-link">TeamViewer Explorer</Link>
          <Link to="/teamviewer-import" className="btn-link">TeamViewer Import</Link>
          <Link to="/incidents?view=teamviewer" className="btn-link">Casos TeamViewer</Link>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
