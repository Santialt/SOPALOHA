import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from '../components/AppShell';
import LoadingBlock from '../components/LoadingBlock';
import DashboardPage from '../pages/DashboardPage';
import LocationsPage from '../pages/LocationsPage';
import LocationDetailPage from '../pages/LocationDetailPage';
import IncidentsPage from '../pages/IncidentsPage';
import TasksPage from '../pages/TasksPage';
import LocationNotesPage from '../pages/LocationNotesPage';
import TeamViewerImportPage from '../pages/TeamViewerImportPage';
import TeamViewerExplorerPage from '../pages/TeamViewerExplorerPage';
import OnCallPage from '../pages/OnCallPage';

const TeamViewerImportedCasesPage = lazy(() => import('../pages/TeamViewerImportedCasesPage'));

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="locations/:id" element={<LocationDetailPage />} />
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="location-notes" element={<LocationNotesPage />} />
        <Route path="on-call" element={<OnCallPage />} />
        <Route path="teamviewer-explorer" element={<TeamViewerExplorerPage />} />
        <Route path="teamviewer-import" element={<TeamViewerImportPage />} />
        <Route
          path="teamviewer-imported-cases"
          element={
            <Suspense fallback={<LoadingBlock label="Cargando casos TeamViewer..." />}>
              <TeamViewerImportedCasesPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
