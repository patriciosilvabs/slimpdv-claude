import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Save, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OptionWithGroup {
  id: string;
  name: string;
  external_code: string | null;
  ifood_code: string | null;
  groups: string[];
}

export function IntegrationCodesPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [changes, setChanges] = useState<Record<string, { external_code?: string; ifood_code?: string }>>({});

  const { data: options, isLoading } = useQuery({
    queryKey: ['complement-options-integration'],
    queryFn: async () => {
      const [optionsRes, linksRes] = await Promise.all([
        supabase
          .from('complement_options')
          .select('id, name, external_code, ifood_code')
          .order('name'),
        supabase
          .from('complement_group_options')
          .select('option_id, group:complement_groups(name)')
      ]);

      if (optionsRes.error) throw optionsRes.error;

      const groupMap: Record<string, string[]> = {};
      (linksRes.data || []).forEach((link: any) => {
        if (!groupMap[link.option_id]) groupMap[link.option_id] = [];
        if (link.group?.name) groupMap[link.option_id].push(link.group.name);
      });

      return (optionsRes.data || []).map(opt => ({
        ...opt,
        groups: groupMap[opt.id] || [],
      })) as OptionWithGroup[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(changes);
      if (!entries.length) return;

      for (const [id, vals] of entries) {
        const update: Record<string, string | null> = {};
        if ('external_code' in vals) update.external_code = vals.external_code || null;
        if ('ifood_code' in vals) update.ifood_code = vals.ifood_code || null;

        const { error } = await supabase
          .from('complement_options')
          .update(update)
          .eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setChanges({});
      queryClient.invalidateQueries({ queryKey: ['complement-options-integration'] });
      queryClient.invalidateQueries({ queryKey: ['complement-options'] });
      toast({ title: 'Códigos salvos com sucesso!' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    },
  });

  const filtered = (options || []).filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.groups.some(g => g.toLowerCase().includes(search.toLowerCase()))
  );

  const getValue = (opt: OptionWithGroup, field: 'external_code' | 'ifood_code') => {
    if (changes[opt.id] && field in changes[opt.id]) return changes[opt.id][field] || '';
    return opt[field] || '';
  };

  const handleChange = (id: string, field: 'external_code' | 'ifood_code', value: string) => {
    setChanges(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const hasChanges = Object.keys(changes).length > 0;

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou grupo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!hasChanges || saveMutation.isPending}
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar ({Object.keys(changes).length})
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Opção</TableHead>
              <TableHead className="w-[200px]">Grupo</TableHead>
              <TableHead className="w-[180px]">Código CW</TableHead>
              <TableHead className="w-[180px]">Código iFood</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Nenhuma opção encontrada
                </TableCell>
              </TableRow>
            ) : filtered.map(opt => (
              <TableRow key={opt.id}>
                <TableCell className="font-medium">{opt.name}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {opt.groups.join(', ') || '—'}
                </TableCell>
                <TableCell>
                  <Input
                    value={getValue(opt, 'external_code')}
                    onChange={e => handleChange(opt.id, 'external_code', e.target.value)}
                    placeholder="—"
                    className="h-8 text-xs"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={getValue(opt, 'ifood_code')}
                    onChange={e => handleChange(opt.id, 'ifood_code', e.target.value)}
                    placeholder="—"
                    className="h-8 text-xs"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
