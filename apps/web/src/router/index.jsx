import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from '../components/AppShell';
import AdminRoute from '../components/AdminRoute';
import LoadingBlock from '../components/LoadingBlock';
import ProtectedRoute from '../components/ProtectedRoute';
import AlohaMasterPage from '../pages/AlohaMasterPage';
import DashboardPage from '../pages/DashboardPage';
import LocationsPage from '../pages/LocationsPage';
import LocationDetailPage from '../pages/LocationDetailPage';
import IncidentsPage from '../pages/IncidentsPage';
import LoginPage from '../pages/LoginPage';
import TasksPage from '../pages/TasksPage';
import UsersPage from '../pages/UsersPage';
import TeamViewerImportPage from '../pages/TeamViewerImportPage';
import TeamViewerExplorerPage from '../pages/TeamViewerExplorerPage';
import OnCallPage from '../pages/OnCallPage';
import TeamViewerImportedCasesPage from '../pages/TeamViewerImportedCasesPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="locations" element={<LocationsPage />} />
          <Route path="aloha-master" element={<AlohaMasterPage />} />
          <Route path="locations/:id" element={<LocationDetailPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="tasks" element={<TasksPage />} />
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
          <Route element={<AdminRoute />}>
            <Route path="users" element={<UsersPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
