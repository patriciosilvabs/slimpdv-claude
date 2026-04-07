import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/contexts/AuthContext';

export interface ProductionShipment {
  id: string;
  from_tenant_id: string;
  to_tenant_id: string;
  ingredient_id: string;
  quantity: number;
  shipped_by: string | null;
  shipped_at: string;
  received_at: string | null;
  received_by: string | null;
  notes: string | null;
}

export interface ShipmentWithDetails extends ProductionShipment {
  from_tenant?: { name: string };
  to_tenant?: { name: string };
  ingredient?: { name: string; unit: string };
  shipper?: { name: string };
  receiver?: { name: string };
}

export function useProductionShipments(options: { 
  direction?: 'sent' | 'received' | 'all';
  ingredientId?: string;
  limit?: number;
} = {}) {
  const { tenant } = useTenant();
  const { direction = 'all', ingredientId, limit = 50 } = options;

  return useQuery({
    queryKey: ['production-shipments', tenant?.id, direction, ingredientId, limit],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      let query = supabase
        .from('production_shipments')
        .select(`
          *,
          from_tenant:tenants!production_shipments_from_tenant_id_fkey(name),
          to_tenant:tenants!production_shipments_to_tenant_id_fkey(name),
          ingredient:ingredients(name, unit)
        `)
        .order('shipped_at', { ascending: false })
        .limit(limit);
      
      if (direction === 'sent') {
        query = query.eq('from_tenant_id', tenant.id);
      } else if (direction === 'received') {
        query = query.eq('to_tenant_id', tenant.id);
      } else {
        query = query.or(`from_tenant_id.eq.${tenant.id},to_tenant_id.eq.${tenant.id}`);
      }
      
      if (ingredientId) {
        query = query.eq('ingredient_id', ingredientId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as unknown as ShipmentWithDetails[];
    },
    enabled: !!tenant?.id,
  });
}

export function useProductionShipmentMutations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const { user } = useAuth();

  const createShipment = useMutation({
    mutationFn: async ({ 
      toTenantId, 
      ingredientId, 
      quantity,
      notes,
    }: { 
      toTenantId: string;
      ingredientId: string;
      quantity: number;
      notes?: string;
    }) => {
      if (!tenant?.id) throw new Error('Tenant não encontrado');
      if (!user?.id) throw new Error('Usuário não autenticado');
      
      // Create shipment record
      const { data: shipment, error: shipmentError } = await supabase
        .from('production_shipments')
        .insert({
          from_tenant_id: tenant.id,
          to_tenant_id: toTenantId,
          ingredient_id: ingredientId,
          quantity,
          shipped_by: user.id,
          notes,
        })
        .select()
        .single();
      
      if (shipmentError) throw shipmentError;
      
      // Get current stock of destination tenant
      const { data: ingredient, error: ingredientError } = await supabase
        .from('ingredients')
        .select('current_stock')
        .eq('id', ingredientId)
        .eq('tenant_id', toTenantId)
        .single();
      
      if (ingredientError) {
        console.warn('Could not find ingredient in destination tenant:', ingredientError);
        // Don't fail - shipment is recorded
        return shipment;
      }
      
      const previousStock = ingredient?.current_stock || 0;
      const newStock = previousStock + quantity;
      
      // Register stock entry at destination
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          ingredient_id: ingredientId,
          movement_type: 'entry',
          quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          tenant_id: toTenantId,
          notes: `Recebimento de produção - Envio #${shipment.id}`,
        });
      
      if (movementError) {
        console.error('Error creating stock movement:', movementError);
      }
      
      // Update stock at destination
      const { error: updateError } = await supabase
        .from('ingredients')
        .update({ 
          current_stock: newStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ingredientId)
        .eq('tenant_id', toTenantId);
      
      if (updateError) {
        console.error('Error updating stock:', updateError);
      }
      
      return shipment;
    },
    onSuccess: () => {
      toast({
        title: 'Envio registrado',
        description: 'Produção enviada e estoque atualizado',
      });
      queryClient.invalidateQueries({ queryKey: ['production-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['production-demand'] });
      queryClient.invalidateQueries({ queryKey: ['consolidated-production-demand'] });
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao registrar envio',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const confirmReceipt = useMutation({
    mutationFn: async (shipmentId: string) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('production_shipments')
        .update({
          received_at: new Date().toISOString(),
          received_by: user.id,
        })
        .eq('id', shipmentId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Recebimento confirmado',
      });
      queryClient.invalidateQueries({ queryKey: ['production-shipments'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao confirmar recebimento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    createShipment,
    confirmReceipt,
  };
}
