import { Navigate } from 'react-router-dom';
import { isSessionValid } from '@/lib/adminAuth';

interface PrivateRouteProps {
  children: React.ReactNode;
}

export function PrivateRoute({ children }: PrivateRouteProps) {
  if (!isSessionValid()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
