import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { Loader2 } from 'lucide-react';

interface RequireTenantProps {
  children: React.ReactNode;
}

export function RequireTenant({ children }: RequireTenantProps) {
  const { user, loading: authLoading } = useAuth();
  const { hasTenant, isLoading: tenantLoading } = useTenant();
  const location = useLocation();

  // Show loading while checking auth/tenant status
  if (authLoading || tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in -> go to auth
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Logged in but no tenant -> go to onboarding
  if (!hasTenant) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
