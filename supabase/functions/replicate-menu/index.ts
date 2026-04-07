import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

interface ReplicateMenuBody {
  source_tenant_id: string;
  target_tenant_ids: string[];
  options: {
    categories: boolean;
    products: boolean;
    variations: boolean;
    complement_groups: boolean;
    complement_options: boolean;
  };
}

interface ReplicationResult {
  success: boolean;
  tenant_id: string;
  tenant_name?: string;
  stats?: {
    categories?: { created: number; updated: number };
    products?: { created: number; updated: number };
    variations?: { created: number; updated: number };
    complement_groups?: { created: number; updated: number };
    complement_options?: { created: number; updated: number };
  };
  error?: string;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const userId = claimsData.claims.sub;

    // Parse body
    const body: ReplicateMenuBody = await req.json();
    const { source_tenant_id, target_tenant_ids, options } = body;

    if (!source_tenant_id || !target_tenant_ids?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is owner of source tenant
    const { data: sourceTenant, error: sourceError } = await supabase
      .from('tenants')
      .select('id, owner_id, name')
      .eq('id', source_tenant_id)
      .single();

    if (sourceError || !sourceTenant) {
      return new Response(
        JSON.stringify({ error: 'Source tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (sourceTenant.owner_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'You are not the owner of the source tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all target tenants and verify ownership
    const { data: targetTenants, error: targetsError } = await supabase
      .from('tenants')
      .select('id, owner_id, name')
      .in('id', target_tenant_ids);

    if (targetsError) {
      return new Response(
        JSON.stringify({ error: 'Error fetching target tenants' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for data operations
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const results: ReplicationResult[] = [];

    for (const targetTenant of targetTenants || []) {
      // Verify user owns this target tenant too
      if (targetTenant.owner_id !== userId) {
        results.push({
          success: false,
          tenant_id: targetTenant.id,
          tenant_name: targetTenant.name,
          error: 'You are not the owner of this target tenant',
        });
        continue;
      }

      try {
        const stats: ReplicationResult['stats'] = {};

        // ID mappings for relationships
        const categoryIdMap = new Map<string, string>();
        const productIdMap = new Map<string, string>();
        const groupIdMap = new Map<string, string>();
        const optionIdMap = new Map<string, string>();

        // 1. Replicate categories
        if (options.categories) {
          const { data: sourceCategories } = await serviceClient
            .from('categories')
            .select('*')
            .eq('tenant_id', source_tenant_id)
            .order('sort_order');

          let created = 0;
          let updated = 0;

          for (const cat of sourceCategories || []) {
            // Check if category exists by name
            const { data: existing } = await serviceClient
              .from('categories')
              .select('id')
              .eq('tenant_id', targetTenant.id)
              .eq('name', cat.name)
              .single();

            if (existing) {
              // Update existing
              await serviceClient
                .from('categories')
                .update({
                  description: cat.description,
                  icon: cat.icon,
                  sort_order: cat.sort_order,
                  is_active: cat.is_active,
                })
                .eq('id', existing.id);
              categoryIdMap.set(cat.id, existing.id);
              updated++;
            } else {
              // Insert new
              const { data: newCat } = await serviceClient
                .from('categories')
                .insert({
                  tenant_id: targetTenant.id,
                  name: cat.name,
                  description: cat.description,
                  icon: cat.icon,
                  sort_order: cat.sort_order,
                  is_active: cat.is_active,
                })
                .select()
                .single();
              if (newCat) {
                categoryIdMap.set(cat.id, newCat.id);
                created++;
              }
            }
          }
          stats.categories = { created, updated };
        }

        // 2. Replicate complement options first (they're referenced by groups)
        if (options.complement_options) {
          const { data: sourceOptions } = await serviceClient
            .from('complement_options')
            .select('*')
            .eq('tenant_id', source_tenant_id)
            .order('sort_order');

          let created = 0;
          let updated = 0;

          for (const opt of sourceOptions || []) {
            const { data: existing } = await serviceClient
              .from('complement_options')
              .select('id')
              .eq('tenant_id', targetTenant.id)
              .eq('name', opt.name)
              .single();

            if (existing) {
              await serviceClient
                .from('complement_options')
                .update({
                  description: opt.description,
                  price: opt.price,
                  cost_price: opt.cost_price,
                  image_url: opt.image_url,
                  is_active: opt.is_active,
                  sort_order: opt.sort_order,
                  internal_code: opt.internal_code,
                  pdv_code: opt.pdv_code,
                  auto_calculate_cost: opt.auto_calculate_cost,
                  enable_stock_control: opt.enable_stock_control,
                })
                .eq('id', existing.id);
              optionIdMap.set(opt.id, existing.id);
              updated++;
            } else {
              const { data: newOpt } = await serviceClient
                .from('complement_options')
                .insert({
                  tenant_id: targetTenant.id,
                  name: opt.name,
                  description: opt.description,
                  price: opt.price,
                  cost_price: opt.cost_price,
                  image_url: opt.image_url,
                  is_active: opt.is_active,
                  sort_order: opt.sort_order,
                  internal_code: opt.internal_code,
                  pdv_code: opt.pdv_code,
                  auto_calculate_cost: opt.auto_calculate_cost,
                  enable_stock_control: opt.enable_stock_control,
                })
                .select()
                .single();
              if (newOpt) {
                optionIdMap.set(opt.id, newOpt.id);
                created++;
              }
            }
          }
          stats.complement_options = { created, updated };
        }

        // 3. Replicate complement groups
        if (options.complement_groups) {
          const { data: sourceGroups } = await serviceClient
            .from('complement_groups')
            .select('*')
            .eq('tenant_id', source_tenant_id)
            .order('sort_order');

          let created = 0;
          let updated = 0;

          for (const grp of sourceGroups || []) {
            const { data: existing } = await serviceClient
              .from('complement_groups')
              .select('id')
              .eq('tenant_id', targetTenant.id)
              .eq('name', grp.name)
              .single();

            const groupData = {
              name: grp.name,
              description: grp.description,
              selection_type: grp.selection_type,
              is_required: grp.is_required,
              min_selections: grp.min_selections,
              max_selections: grp.max_selections,
              is_active: grp.is_active,
              sort_order: grp.sort_order,
              visibility: grp.visibility,
              channels: grp.channels,
              applies_per_unit: grp.applies_per_unit,
              unit_count: grp.unit_count,
              price_calculation_type: grp.price_calculation_type,
            };

            let targetGroupId: string;

            if (existing) {
              await serviceClient
                .from('complement_groups')
                .update(groupData)
                .eq('id', existing.id);
              targetGroupId = existing.id;
              groupIdMap.set(grp.id, existing.id);
              updated++;
            } else {
              const { data: newGrp } = await serviceClient
                .from('complement_groups')
                .insert({ ...groupData, tenant_id: targetTenant.id })
                .select()
                .single();
              if (newGrp) {
                targetGroupId = newGrp.id;
                groupIdMap.set(grp.id, newGrp.id);
                created++;
              } else {
                continue;
              }
            }

            // Replicate group_options relationship
            if (options.complement_options) {
              const { data: groupOptions } = await serviceClient
                .from('complement_group_options')
                .select('*')
                .eq('group_id', grp.id);

              // Delete existing links in target
              await serviceClient
                .from('complement_group_options')
                .delete()
                .eq('group_id', targetGroupId);

              // Insert new links
              for (const go of groupOptions || []) {
                const targetOptionId = optionIdMap.get(go.option_id);
                if (targetOptionId) {
                  await serviceClient
                    .from('complement_group_options')
                    .insert({
                      tenant_id: targetTenant.id,
                      group_id: targetGroupId,
                      option_id: targetOptionId,
                      sort_order: go.sort_order,
                      max_quantity: go.max_quantity,
                      price_override: go.price_override,
                    });
                }
              }
            }
          }
          stats.complement_groups = { created, updated };
        }

        // 4. Replicate products
        if (options.products) {
          const { data: sourceProducts } = await serviceClient
            .from('products')
            .select('*')
            .eq('tenant_id', source_tenant_id)
            .order('sort_order');

          let created = 0;
          let updated = 0;

          for (const prod of sourceProducts || []) {
            const { data: existing } = await serviceClient
              .from('products')
              .select('id')
              .eq('tenant_id', targetTenant.id)
              .eq('name', prod.name)
              .single();

            const targetCategoryId = prod.category_id ? categoryIdMap.get(prod.category_id) : null;

            const productData = {
              name: prod.name,
              description: prod.description,
              price: prod.price,
              cost_price: prod.cost_price,
              category_id: targetCategoryId || null,
              is_available: prod.is_available,
              is_featured: prod.is_featured,
              is_promotion: prod.is_promotion,
              promotion_price: prod.promotion_price,
              preparation_time: prod.preparation_time,
              image_url: prod.image_url,
              sort_order: prod.sort_order,
              label: prod.label,
              internal_code: prod.internal_code,
              pdv_code: prod.pdv_code,
              print_sector_id: null, // Reset print sector as it's tenant-specific
            };

            let targetProductId: string;

            if (existing) {
              await serviceClient
                .from('products')
                .update(productData)
                .eq('id', existing.id);
              targetProductId = existing.id;
              productIdMap.set(prod.id, existing.id);
              updated++;
            } else {
              const { data: newProd } = await serviceClient
                .from('products')
                .insert({ ...productData, tenant_id: targetTenant.id })
                .select()
                .single();
              if (newProd) {
                targetProductId = newProd.id;
                productIdMap.set(prod.id, newProd.id);
                created++;
              } else {
                continue;
              }
            }

            // Replicate product_complement_groups
            if (options.complement_groups) {
              const { data: productGroups } = await serviceClient
                .from('product_complement_groups')
                .select('*')
                .eq('product_id', prod.id);

              // Delete existing links
              await serviceClient
                .from('product_complement_groups')
                .delete()
                .eq('product_id', targetProductId);

              // Insert new links
              for (const pg of productGroups || []) {
                const targetGroupId = groupIdMap.get(pg.group_id);
                if (targetGroupId) {
                  await serviceClient
                    .from('product_complement_groups')
                    .insert({
                      tenant_id: targetTenant.id,
                      product_id: targetProductId,
                      group_id: targetGroupId,
                      sort_order: pg.sort_order,
                    });
                }
              }
            }
          }
          stats.products = { created, updated };
        }

        // 5. Replicate variations
        if (options.variations && options.products) {
          const { data: sourceVariations } = await serviceClient
            .from('product_variations')
            .select('*')
            .eq('tenant_id', source_tenant_id);

          let created = 0;
          let updated = 0;

          for (const variation of sourceVariations || []) {
            const targetProductId = productIdMap.get(variation.product_id);
            if (!targetProductId) continue;

            const { data: existing } = await serviceClient
              .from('product_variations')
              .select('id')
              .eq('product_id', targetProductId)
              .eq('name', variation.name)
              .single();

            if (existing) {
              await serviceClient
                .from('product_variations')
                .update({
                  description: variation.description,
                  price_modifier: variation.price_modifier,
                  is_active: variation.is_active,
                })
                .eq('id', existing.id);
              updated++;
            } else {
              await serviceClient
                .from('product_variations')
                .insert({
                  tenant_id: targetTenant.id,
                  product_id: targetProductId,
                  name: variation.name,
                  description: variation.description,
                  price_modifier: variation.price_modifier,
                  is_active: variation.is_active,
                });
              created++;
            }
          }
          stats.variations = { created, updated };
        }

        results.push({
          success: true,
          tenant_id: targetTenant.id,
          tenant_name: targetTenant.name,
          stats,
        });

      } catch (error) {
        console.error(`Error replicating to ${targetTenant.name}:`, error);
        results.push({
          success: false,
          tenant_id: targetTenant.id,
          tenant_name: targetTenant.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log('Replication completed:', results);

    return new Response(
      JSON.stringify({ results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in replicate-menu:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
