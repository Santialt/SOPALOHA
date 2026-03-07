import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from '../components/AppShell';
import DashboardPage from '../pages/DashboardPage';
import LocationsPage from '../pages/LocationsPage';
import LocationDetailPage from '../pages/LocationDetailPage';
import IncidentsPage from '../pages/IncidentsPage';
import WeeklyTasksPage from '../pages/WeeklyTasksPage';
import LocationNotesPage from '../pages/LocationNotesPage';
import TeamViewerImportPage from '../pages/TeamViewerImportPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="locations/:id" element={<LocationDetailPage />} />
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="weekly-tasks" element={<WeeklyTasksPage />} />
        <Route path="location-notes" element={<LocationNotesPage />} />
        <Route path="teamviewer-import" element={<TeamViewerImportPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
