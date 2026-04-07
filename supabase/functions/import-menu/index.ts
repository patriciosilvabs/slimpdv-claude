import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'npm:xlsx@0.18.5'
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts'

interface Row {
  tipo: string
  categoria: string
  nome: string
  codigo: string
  preco: number
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightRequest(req)
  if (corsResponse) return corsResponse

  const corsHeaders = getCorsHeaders(req)
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: membership } = await adminClient
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Tenant não encontrado' }), { status: 400, headers })
    }
    const tenantId = membership.tenant_id

    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) {
      return new Response(JSON.stringify({ error: 'Arquivo não enviado' }), { status: 400, headers })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet)

    const rows: Row[] = rawRows.map(r => ({
      tipo: String(r['Tipo'] || '').trim().toUpperCase(),
      categoria: String(r['Categoria/Complemento'] || '').trim(),
      nome: String(r['Nome'] || '').trim(),
      codigo: String(r['Código interno'] || r['Codigo interno'] || '').trim(),
      preco: parseFloat(String(r['Preço'] || r['Preco'] || '0').replace(',', '.')) || 0,
    }))

    const stats = {
      categories_created: 0,
      products_created: 0,
      groups_created: 0,
      options_created: 0,
      links_created: 0,
      total_rows: rows.length,
      deleted: { categories: 0, products: 0, groups: 0, options: 0 },
      errors: [] as string[],
    }

    // ========== LIMPAR DADOS EXISTENTES ==========
    await adminClient.from('product_complement_groups').delete().eq('tenant_id', tenantId)
    await adminClient.from('complement_group_options').delete().eq('tenant_id', tenantId)
    await adminClient.from('complement_option_ingredients').delete().eq('tenant_id', tenantId)
    await adminClient.from('complement_options').delete().eq('tenant_id', tenantId)
    await adminClient.from('complement_groups').delete().eq('tenant_id', tenantId)
    await adminClient.from('product_extra_links').delete().eq('tenant_id', tenantId)
    await adminClient.from('product_ingredients').delete().eq('tenant_id', tenantId)
    await adminClient.from('product_variations').delete().eq('tenant_id', tenantId)
    await adminClient.from('products').delete().eq('tenant_id', tenantId)
    await adminClient.from('categories').delete().eq('tenant_id', tenantId)

    // ========== PHASE 1: Collect unique categories and groups ==========
    const uniqueCategories = new Map<string, number>() // lowercase -> sort_order
    const uniqueGroups = new Map<string, number>()
    
    let catOrder = 0
    let grpOrder = 0
    for (const row of rows) {
      if (row.tipo === 'PRODUTO') {
        const key = row.categoria.toLowerCase()
        if (!uniqueCategories.has(key)) {
          uniqueCategories.set(key, catOrder++)
        }
      } else if (row.tipo === 'OPÇÃO' || row.tipo === 'OPCAO') {
        const key = row.categoria.toLowerCase()
        if (!uniqueGroups.has(key)) {
          uniqueGroups.set(key, grpOrder++)
        }
      }
    }

    // ========== PHASE 2: Batch insert categories ==========
    const categoryCache = new Map<string, string>()
    if (uniqueCategories.size > 0) {
      const catInserts = Array.from(uniqueCategories.entries()).map(([key, order]) => {
        // Find original casing
        const original = rows.find(r => r.tipo === 'PRODUTO' && r.categoria.toLowerCase() === key)
        return {
          name: original?.categoria || key,
          tenant_id: tenantId,
          is_active: true,
          sort_order: order,
        }
      })

      const { data: catData, error: catError } = await adminClient
        .from('categories')
        .insert(catInserts)
        .select('id, name')

      if (catError) {
        stats.errors.push(`Erro ao criar categorias: ${catError.message}`)
      } else if (catData) {
        for (const cat of catData) {
          categoryCache.set(cat.name.toLowerCase(), cat.id)
          stats.categories_created++
        }
      }
    }

    // ========== PHASE 3: Batch insert complement groups ==========
    const groupCache = new Map<string, string>()
    if (uniqueGroups.size > 0) {
      const grpInserts = Array.from(uniqueGroups.entries()).map(([key, order]) => {
        const original = rows.find(r => (r.tipo === 'OPÇÃO' || r.tipo === 'OPCAO') && r.categoria.toLowerCase() === key)
        return {
          name: original?.categoria || key,
          tenant_id: tenantId,
          is_active: true,
          selection_type: 'multiple',
          is_required: false,
          min_selections: 0,
          max_selections: 10,
          sort_order: order,
        }
      })

      const { data: grpData, error: grpError } = await adminClient
        .from('complement_groups')
        .insert(grpInserts)
        .select('id, name')

      if (grpError) {
        stats.errors.push(`Erro ao criar grupos: ${grpError.message}`)
      } else if (grpData) {
        for (const grp of grpData) {
          groupCache.set(grp.name.toLowerCase(), grp.id)
          stats.groups_created++
        }
      }
    }

    // ========== PHASE 4: Batch insert products ==========
    const productInserts: any[] = []
    const productRowIndices: number[] = []
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row.tipo === 'PRODUTO') {
        const categoryId = categoryCache.get(row.categoria.toLowerCase())
        if (!categoryId) {
          stats.errors.push(`Linha ${i + 2}: Categoria "${row.categoria}" não encontrada`)
          continue
        }
        productInserts.push({
          name: row.nome,
          price: row.preco,
          category_id: categoryId,
          internal_code: row.codigo || null,
          tenant_id: tenantId,
          is_available: true,
          preparation_time: 15,
          sort_order: productInserts.length,
        })
        productRowIndices.push(i)
      }
    }

    // Map row index -> product id
    const productIdByRowIndex = new Map<number, string>()
    
    // Insert in batches of 500
    for (let b = 0; b < productInserts.length; b += 500) {
      const batch = productInserts.slice(b, b + 500)
      const batchIndices = productRowIndices.slice(b, b + 500)
      
      const { data: prodData, error: prodError } = await adminClient
        .from('products')
        .insert(batch)
        .select('id')

      if (prodError) {
        stats.errors.push(`Erro ao criar produtos (lote ${b}): ${prodError.message}`)
      } else if (prodData) {
        for (let j = 0; j < prodData.length; j++) {
          productIdByRowIndex.set(batchIndices[j], prodData[j].id)
          stats.products_created++
        }
      }
    }

    // ========== PHASE 5: Batch insert options and collect links ==========
    const optionInserts: any[] = []
    const optionMeta: { groupKey: string; productRowIndex: number }[] = []
    
    let lastProductRowIndex = -1
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row.tipo === 'PRODUTO') {
        lastProductRowIndex = i
      } else if (row.tipo === 'OPÇÃO' || row.tipo === 'OPCAO') {
        if (lastProductRowIndex < 0 || !productIdByRowIndex.has(lastProductRowIndex)) {
          stats.errors.push(`Linha ${i + 2}: OPÇÃO sem PRODUTO anterior válido`)
          continue
        }
        optionInserts.push({
          name: row.nome,
          price: row.preco,
          internal_code: row.codigo || null,
          external_code: row.codigo || null,
          tenant_id: tenantId,
          is_active: true,
          sort_order: optionInserts.length,
        })
        optionMeta.push({
          groupKey: row.categoria.toLowerCase(),
          productRowIndex: lastProductRowIndex,
        })
      }
    }

    const optionIds: string[] = []
    for (let b = 0; b < optionInserts.length; b += 500) {
      const batch = optionInserts.slice(b, b + 500)
      
      const { data: optData, error: optError } = await adminClient
        .from('complement_options')
        .insert(batch)
        .select('id')

      if (optError) {
        stats.errors.push(`Erro ao criar opções (lote ${b}): ${optError.message}`)
      } else if (optData) {
        for (const opt of optData) {
          optionIds.push(opt.id)
          stats.options_created++
        }
      }
    }

    // ========== PHASE 6: Batch insert group-option links ==========
    const groupOptionInserts: any[] = []
    for (let i = 0; i < optionIds.length; i++) {
      const meta = optionMeta[i]
      const groupId = groupCache.get(meta.groupKey)
      if (!groupId) continue
      groupOptionInserts.push({
        group_id: groupId,
        option_id: optionIds[i],
        tenant_id: tenantId,
      })
    }

    for (let b = 0; b < groupOptionInserts.length; b += 500) {
      const batch = groupOptionInserts.slice(b, b + 500)
      await adminClient.from('complement_group_options').insert(batch)
    }

    // ========== PHASE 7: Batch insert product-group links ==========
    const productGroupSet = new Set<string>()
    const productGroupInserts: any[] = []
    
    for (let i = 0; i < optionMeta.length; i++) {
      const meta = optionMeta[i]
      const productId = productIdByRowIndex.get(meta.productRowIndex)
      const groupId = groupCache.get(meta.groupKey)
      if (!productId || !groupId) continue
      
      const key = `${productId}:${groupId}`
      if (productGroupSet.has(key)) continue
      productGroupSet.add(key)
      
      productGroupInserts.push({
        product_id: productId,
        group_id: groupId,
        tenant_id: tenantId,
      })
    }

    for (let b = 0; b < productGroupInserts.length; b += 500) {
      const batch = productGroupInserts.slice(b, b + 500)
      const { error } = await adminClient.from('product_complement_groups').insert(batch)
      if (!error) stats.links_created += batch.length
    }

    return new Response(JSON.stringify({ success: true, stats }), { headers })
  } catch (err: any) {
    console.error('Import error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
