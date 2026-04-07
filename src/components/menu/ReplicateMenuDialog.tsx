import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGroupStores } from '@/hooks/useGroupStores';
import { useMenuReplication, ReplicateMenuParams } from '@/hooks/useMenuReplication';
import { useTenant } from '@/hooks/useTenant';
import { Building2, AlertTriangle, Loader2, Package, Layers, Grid3X3, Settings2 } from 'lucide-react';

interface ReplicateMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReplicateMenuDialog({ open, onOpenChange }: ReplicateMenuDialogProps) {
  const { tenantId, tenant } = useTenant();
  const { otherStores, isLoading: storesLoading } = useGroupStores();
  const { replicateMenu, isReplicating } = useMenuReplication();
  
  // Selected targets
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  
  // Selected options
  const [options, setOptions] = useState({
    categories: true,
    products: true,
    variations: true,
    complement_groups: true,
    complement_options: true,
  });
  
  const toggleStore = (storeId: string) => {
    setSelectedStores(prev => 
      prev.includes(storeId)
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };
  
  const toggleOption = (key: keyof typeof options) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const selectAllStores = () => {
    setSelectedStores(otherStores.map(s => s.id));
  };
  
  const deselectAllStores = () => {
    setSelectedStores([]);
  };
  
  const handleReplicate = async () => {
    if (!tenantId || selectedStores.length === 0) return;
    
    const params: ReplicateMenuParams = {
      source_tenant_id: tenantId,
      target_tenant_ids: selectedStores,
      options,
    };
    
    await replicateMenu(params);
    onOpenChange(false);
    
    // Reset state
    setSelectedStores([]);
    setOptions({
      categories: true,
      products: true,
      variations: true,
      complement_groups: true,
      complement_options: true,
    });
  };
  
  const hasSelectedAnyOption = Object.values(options).some(v => v);
  const canReplicate = selectedStores.length > 0 && hasSelectedAnyOption && !isReplicating;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Replicar Cardápio
          </DialogTitle>
          <DialogDescription>
            Replique o cardápio de <strong>{tenant?.name || 'esta loja'}</strong> para outras lojas do seu grupo.
          </DialogDescription>
        </DialogHeader>
        
        {storesLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Carregando lojas...
          </div>
        ) : otherStores.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Você não possui outras lojas no grupo.</p>
            <p className="text-sm mt-1">Crie mais lojas em Configurações → Lojas.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* O que replicar */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">O que replicar:</Label>
              <div className="grid grid-cols-2 gap-3">
                <div 
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    options.categories ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                  }`}
                  onClick={() => toggleOption('categories')}
                >
                  <Checkbox checked={options.categories} />
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Categorias</span>
                  </div>
                </div>
                
                <div 
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    options.products ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                  }`}
                  onClick={() => toggleOption('products')}
                >
                  <Checkbox checked={options.products} />
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Produtos</span>
                  </div>
                </div>
                
                <div 
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    options.variations ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                  }`}
                  onClick={() => toggleOption('variations')}
                >
                  <Checkbox checked={options.variations} />
                  <div className="flex items-center gap-2">
                    <Grid3X3 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Variações</span>
                  </div>
                </div>
                
                <div 
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    options.complement_groups ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                  }`}
                  onClick={() => toggleOption('complement_groups')}
                >
                  <Checkbox checked={options.complement_groups} />
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Grupos de Complemento</span>
                  </div>
                </div>
                
                <div 
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors col-span-2 ${
                    options.complement_options ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                  }`}
                  onClick={() => toggleOption('complement_options')}
                >
                  <Checkbox checked={options.complement_options} />
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Opções de Complemento</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Lojas destino */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Replicar para:</Label>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs"
                    onClick={selectAllStores}
                  >
                    Todas
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs"
                    onClick={deselectAllStores}
                  >
                    Nenhuma
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {otherStores.map((store) => (
                  <div 
                    key={store.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedStores.includes(store.id) 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => toggleStore(store.id)}
                  >
                    <Checkbox checked={selectedStores.includes(store.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium truncate">{store.name}</span>
                      </div>
                      <code className="text-xs text-muted-foreground">/{store.slug}</code>
                    </div>
                    {!store.is_active && (
                      <Badge variant="secondary" className="text-[10px]">Inativa</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Aviso */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Itens com o <strong>mesmo nome</strong> serão atualizados. 
                Novos itens serão criados. Esta ação não pode ser desfeita.
              </AlertDescription>
            </Alert>
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isReplicating}>
            Cancelar
          </Button>
          <Button onClick={handleReplicate} disabled={!canReplicate}>
            {isReplicating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Replicando...
              </>
            ) : (
              <>
                <Building2 className="h-4 w-4 mr-2" />
                Replicar para {selectedStores.length} loja(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
