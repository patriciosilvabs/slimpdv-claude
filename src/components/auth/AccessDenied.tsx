import { ShieldX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import PDVLayout from '@/components/layout/PDVLayout';

interface AccessDeniedProps {
  permission?: string;
  message?: string;
}

export function AccessDenied({ permission, message }: AccessDeniedProps) {
  return (
    <PDVLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <div className="p-4 bg-destructive/10 rounded-full mb-4">
              <ShieldX className="h-12 w-12 text-destructive" />
            </div>
            <h2 className="text-xl font-bold mb-2">Acesso Negado</h2>
            <p className="text-muted-foreground mb-4">
              {message || 'Você não tem permissão para acessar esta funcionalidade.'}
            </p>
            {permission && (
              <p className="text-sm text-muted-foreground mb-4">
                Permissão necessária: <code className="bg-muted px-2 py-0.5 rounded">{permission}</code>
              </p>
            )}
            <Link to="/dashboard">
              <Button variant="outline">
                Voltar ao Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </PDVLayout>
  );
}
