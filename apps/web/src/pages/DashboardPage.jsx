import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import InlineError from '../components/InlineError';
import LoadingBlock from '../components/LoadingBlock';
import StatCard from '../components/StatCard';
import { api } from '../services/api';

function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ locations: 0, incidents: 0, tasks: 0 });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const [locations, incidents, tasks] = await Promise.all([
          api.getLocations(),
          api.getIncidents(),
          api.getWeeklyTasks()
        ]);

        setStats({
          locations: locations.length,
          incidents: incidents.length,
          tasks: tasks.length
        });
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
        <StatCard label="Tareas Semanales" value={stats.tasks} tone="neutral" />
      </div>

      <section className="section-card">
        <div className="section-head">
          <h2>Accesos rapidos</h2>
          <small className="panel-caption">Flujos operativos frecuentes</small>
        </div>
        <div className="quick-links">
          <Link to="/locations" className="btn-link">Ver locales</Link>
          <Link to="/incidents" className="btn-link">Gestionar incidentes</Link>
          <Link to="/weekly-tasks" className="btn-link">Gestionar tareas</Link>
          <Link to="/location-notes" className="btn-link">Notas tecnicas</Link>
          <Link to="/teamviewer-explorer" className="btn-link">TeamViewer Explorer</Link>
          <Link to="/teamviewer-import" className="btn-link">TeamViewer Import</Link>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;