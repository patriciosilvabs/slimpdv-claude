import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { Loader2 } from 'lucide-react';

interface RequirePlatformAdminProps {
  children: ReactNode;
}

export function RequirePlatformAdmin({ children }: RequirePlatformAdminProps) {
  const { isPlatformAdmin, isLoading } = usePlatformAdmin();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
