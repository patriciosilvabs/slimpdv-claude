import { ReactNode } from 'react';
import { useUserRole, AppRole } from '@/hooks/useUserRole';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldX, Loader2 } from 'lucide-react';

interface RequireRoleProps {
  children: ReactNode;
  roles: AppRole[];
  fallback?: ReactNode;
  showAccessDenied?: boolean;
}

export function RequireRole({ children, roles, fallback, showAccessDenied = true }: RequireRoleProps) {
  const { hasAnyRole, isLoading, roles: userRoles } = useUserRole();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If user has no roles at all, they might be the first user (admin setup)
  // Or if they have any of the required roles
  if (userRoles.length === 0 || hasAnyRole(roles)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showAccessDenied) {
    return (
      <Card className="max-w-md mx-auto mt-12">
        <CardContent className="flex flex-col items-center p-8 text-center">
          <div className="p-4 bg-destructive/10 rounded-full mb-4">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta área.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Funções necessárias: {roles.join(', ')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return null;
}

export function AdminOnly({ children }: { children: ReactNode }) {
  return <RequireRole roles={['admin']}>{children}</RequireRole>;
}

export function CashierOnly({ children }: { children: ReactNode }) {
  return <RequireRole roles={['admin', 'cashier']}>{children}</RequireRole>;
}

export function WaiterOnly({ children }: { children: ReactNode }) {
  return <RequireRole roles={['admin', 'waiter']}>{children}</RequireRole>;
}

export function KitchenOnly({ children }: { children: ReactNode }) {
  return <RequireRole roles={['admin', 'kitchen']}>{children}</RequireRole>;
}

export function KdsOnly({ children }: { children: ReactNode }) {
  return <RequireRole roles={['admin', 'kds']}>{children}</RequireRole>;
}
