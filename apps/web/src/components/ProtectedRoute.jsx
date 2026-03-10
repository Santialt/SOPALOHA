import { Navigate, Outlet, useLocation } from 'react-router-dom';
import LoadingBlock from './LoadingBlock';
import { useAuth } from '../contexts/AuthContext';

function ProtectedRoute() {
  const location = useLocation();
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return <LoadingBlock label="Validando sesion..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
