import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://72.61.25.92:5000/api';

interface ImportStats {
  categories_created: number;
  products_created: number;
  groups_created: number;
  options_created: number;
  links_created: number;
  total_rows: number;
  deleted: { categories: number; products: number; groups: number; options: number };
  errors: string[];
}

interface ImportResult {
  success: boolean;
  stats: ImportStats;
  error?: string;
}

export function useMenuImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const importFile = async (file: File) => {
    setIsImporting(true);
    setResult(null);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('Não autenticado');

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/import-menu`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data: ImportResult = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro na importação');
      }

      setResult(data);

      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['complement-groups'] });
      queryClient.invalidateQueries({ queryKey: ['complement-options'] });
      queryClient.invalidateQueries({ queryKey: ['complement-group-options'] });
      queryClient.invalidateQueries({ queryKey: ['product-complement-groups'] });

      const s = data.stats;
      toast({
        title: 'Importação concluída!',
        description: `${s.products_created} produtos, ${s.categories_created} categorias, ${s.groups_created} grupos, ${s.options_created} opções criados`,
      });

      return data;
    } catch (err: any) {
      const errorResult: ImportResult = {
        success: false,
        stats: {
          categories_created: 0,
          products_created: 0,
          groups_created: 0, options_created: 0,
          links_created: 0, total_rows: 0,
          deleted: { categories: 0, products: 0, groups: 0, options: 0 },
          errors: [err.message],
        },
        error: err.message,
      };
      setResult(errorResult);
      toast({
        title: 'Erro na importação',
        description: err.message,
        variant: 'destructive',
      });
      return errorResult;
    } finally {
      setIsImporting(false);
    }
  };

  const reset = () => setResult(null);

  return { importFile, isImporting, result, reset };
}
