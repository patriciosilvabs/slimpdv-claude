import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface UnmappedSalesAlertProps {
  count: number;
}

export function UnmappedSalesAlert({ count }: UnmappedSalesAlertProps) {
  return (
    <Alert variant="destructive" className="border-orange-500/50 bg-orange-500/10">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="text-orange-600">Itens sem Ficha Técnica</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>
          {count} {count === 1 ? 'item vendido não possui' : 'itens vendidos não possuem'} ficha técnica configurada. 
          O estoque desses itens não foi deduzido automaticamente.
        </span>
        <Button variant="outline" size="sm" asChild className="ml-4 shrink-0">
          <Link to="/stock">Ver Detalhes</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
