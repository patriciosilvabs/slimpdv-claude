import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGroupStores } from '@/hooks/useGroupStores';
import { useTenant } from '@/hooks/useTenant';
import { Building2, Plus, ExternalLink, Check, Settings, Copy, Link2, Globe, Share2, Trash2 } from 'lucide-react';
import { useTenantContext } from '@/contexts/TenantContext';
import { client as apiClient } from '@/integrations/api/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { StoreConfigModal } from './StoreConfigModal';

export function StoresSettings() {
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const [configStore, setConfigStore] = useState<{ id: string; name: string; slug: string; created_at: string; is_active?: boolean } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { setActiveTenant, refreshTenants } = useTenantContext();
  const queryClient = useQueryClient();
  const { stores, isLoading, isOwnerOfGroup } = useGroupStores();

  const handleCreateStore = () => {
    navigate('/create-store');
  };

  const handleSwitchToStore = (storeId: string) => {
    if (storeId !== tenantId) {
      setActiveTenant(storeId);
    }
  };

  const getStoreUrl = (slug: string) => {
    return `${window.location.origin}/loja/${slug}`;
  };

  const handleCopyLink = async (slug: string) => {
    const url = getStoreUrl(slug);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado para a área de transferência!');
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success('Link copiado!');
    }
  };

  const handleDeleteStore = async (storeId: string, storeName: string) => {
    if (!confirm(`Tem certeza que deseja excluir a loja "${storeName}"? Esta ação não pode ser desfeita.`)) return;
    setDeletingId(storeId);
    try {
      await apiClient.delete(`/tenants/${storeId}`);
      toast.success('Loja excluída com sucesso!');
      await refreshTenants();
      queryClient.invalidateQueries({ queryKey: ['all-tenant-memberships'] });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir loja');
    } finally {
      setDeletingId(null);
    }
  };

  const handleShareLink = async (store: { name: string; slug: string }) => {
    const url = getStoreUrl(store.slug);
    if (navigator.share) {
      try {
        await navigator.share({
          title: store.name,
          text: `Confira o cardápio de ${store.name}!`,
          url,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopyLink(store.slug);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Minhas Lojas</CardTitle>
          <CardDescription>Carregando...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Minhas Lojas
            </CardTitle>
            <CardDescription>
              Gerencie todas as lojas do seu grupo. 
              {stores.length > 1 && ` Você possui ${stores.length} lojas.`}
            </CardDescription>
          </div>
          {isOwnerOfGroup && (
            <Button onClick={handleCreateStore}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Loja
            </Button>
          )}
        </CardHeader>
      </Card>

      {/* Store cards */}
      {stores.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-1">Nenhuma loja encontrada</p>
              <p className="text-sm mb-4">Crie sua primeira loja para começar a vender</p>
              <Button onClick={handleCreateStore}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Loja
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        stores.map((store) => {
          const isCurrentStore = store.id === tenantId;
          const storeUrl = getStoreUrl(store.slug);

          return (
            <Card 
              key={store.id} 
              className={`transition-all ${
                isCurrentStore 
                  ? 'border-primary ring-1 ring-primary/20' 
                  : 'hover:border-muted-foreground/30'
              }`}
            >
              {/* Store info header */}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{store.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          Criada em {new Date(store.created_at).toLocaleDateString('pt-BR')}
                        </span>
                        {!store.is_active && (
                          <Badge variant="secondary" className="text-[10px]">
                            Inativa
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {isCurrentStore && (
                    <Badge variant="default" className="flex-shrink-0">
                      <Check className="h-3 w-3 mr-1" />
                      Loja atual
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Link section - PROMINENT */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Globe className="h-4 w-4 text-primary" />
                    Link do Cardápio Online
                  </div>
                  
                  {/* URL display */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-background border rounded-lg px-3 py-2.5 text-sm font-mono truncate select-all">
                      {storeUrl}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => handleCopyLink(store.slug)}
                      className="gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      Copiar Link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a 
                        href={storeUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Abrir Cardápio
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShareLink(store)}
                      className="gap-2"
                    >
                      <Share2 className="h-4 w-4" />
                      Compartilhar
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Compartilhe este link com seus clientes para que possam fazer pedidos online.
                  </p>
                </div>

                {/* Store actions */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {isCurrentStore ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfigStore(store)}
                      className="gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Configurações
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSwitchToStore(store.id)}
                        className="gap-2"
                      >
                        <Link2 className="h-4 w-4" />
                        Acessar Loja
                      </Button>
                      {isOwnerOfGroup && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteStore(store.id, store.name)}
                          disabled={deletingId === store.id}
                          className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                        >
                          <Trash2 className="h-4 w-4" />
                          {deletingId === store.id ? 'Excluindo...' : 'Excluir'}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Store config modal */}
      {configStore && (
        <StoreConfigModal
          store={configStore}
          open={!!configStore}
          onClose={() => setConfigStore(null)}
        />
      )}

      {/* Info sobre replicação */}
      {stores.length > 1 && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-medium mb-1">Replicar Cardápio</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Você pode replicar o cardápio completo de uma loja para outras do seu grupo.
                  Acesse o <strong>Menu</strong> e clique em <strong>"Replicar para outras lojas"</strong>.
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/menu')}
                >
                  Ir para Menu
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}