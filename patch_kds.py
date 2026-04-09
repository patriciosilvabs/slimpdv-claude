import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('72.61.25.92', username='root', password='sshpass')

def run(cmd, timeout=300):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode()
    err = stderr.read().decode()
    return out, err

sftp = ssh.open_sftp()

# Read both files
with sftp.open('/var/www/slimpdv/src/hooks/useKdsActions.ts', 'r') as f:
    actions = f.read().decode()

with sftp.open('/var/www/slimpdv/src/components/kds/OvenKdsView.tsx', 'r') as f:
    oven = f.read().decode()

print("Files read successfully")
print(f"useKdsActions.ts length: {len(actions)}")
print(f"OvenKdsView.tsx length: {len(oven)}")

# ---- PATCH 1: useKdsActions.ts ----
old1 = (
    "  // Dispatch oven items (DESPACHAR)\n"
    "  const dispatchOvenItems = useMutation({\n"
    "    mutationFn: async (itemIds: string[]) => {\n"
    "      if (user?.id) {\n"
    "        const { data: items, error: fetchError } = await supabase\n"
    "          .from('order_items')\n"
    "          .select('id, order_id, current_station_id, tenant_id')\n"
    "          .in('id', itemIds);\n"
    "        if (fetchError) throw fetchError;\n"
    "\n"
    "        const { error } = await supabase\n"
    "          .from('order_items')\n"
    "          .update({\n"
    "            current_station_id: null,\n"
    "            station_status: 'dispatched',\n"
    "            station_completed_at: new Date().toISOString(),\n"
    "          })\n"
    "          .in('id', itemIds);\n"
    "        if (error) throw error;\n"
    "\n"
    "        if (items && items.length > 0) {\n"
    "          // Fire-and-forget logs\n"
    "          const logs = items\n"
    "            .filter(i => i.current_station_id)\n"
    "            .map(i => ({\n"
    "              order_item_id: i.id,\n"
    "              station_id: i.current_station_id!,\n"
    "              action: 'dispatched',\n"
    "              performed_by: user.id,\n"
    "              tenant_id: i.tenant_id,\n"
    "            }));\n"
    "          if (logs.length > 0) {\n"
    "            supabase.from('kds_station_logs').insert(logs).then(() => {});\n"
    "          }\n"
    "\n"
    "          // Parallelize order completion checks\n"
    "          const orderIds = [...new Set(items.map(i => i.order_id))];\n"
    "          await Promise.all(\n"
    "            orderIds.map(orderId => supabase.rpc('check_order_completion', { _order_id: orderId }))\n"
    "          );\n"
    "        }\n"
    "        return true;\n"
    "      }\n"
    "      return invokeDeviceAction('dispatch_oven_items', { item_ids: itemIds });\n"
    "    },\n"
    "    onMutate: (itemIds) => {\n"
    "      const idSet = new Set(itemIds);\n"
    "      const snapshots = snapshotAndPatch(\n"
    "        [['oven-items']],\n"
    "        (old) => old?.filter(i => !idSet.has(i.id))\n"
    "      );\n"
    "      return { snapshots };\n"
    "    },"
)

new1 = (
    "  // Dispatch oven items (DESPACHAR)\n"
    "  const dispatchOvenItems = useMutation({\n"
    "    mutationFn: async ({ itemIds, waiterServeStationId }: { itemIds: string[]; waiterServeStationId?: string | null }) => {\n"
    "      if (user?.id) {\n"
    "        // Fetch items with order_type to route dine_in to waiter_serve\n"
    "        const { data: items, error: fetchError } = await supabase\n"
    "          .from('order_items')\n"
    "          .select('id, order_id, current_station_id, tenant_id, order:orders(order_type)')\n"
    "          .in('id', itemIds);\n"
    "        if (fetchError) throw fetchError;\n"
    "\n"
    "        const now = new Date().toISOString();\n"
    "\n"
    "        // Split: dine_in (with waiter_serve configured) vs others\n"
    "        const dineInIds = waiterServeStationId\n"
    "          ? (items || []).filter(i => (i.order as any)?.order_type === 'dine_in').map(i => i.id)\n"
    "          : [];\n"
    "        const otherIds = (items || []).filter(i => !dineInIds.includes(i.id)).map(i => i.id);\n"
    "\n"
    "        // Route dine_in to waiter_serve station\n"
    "        if (dineInIds.length > 0 && waiterServeStationId) {\n"
    "          const { error } = await supabase\n"
    "            .from('order_items')\n"
    "            .update({\n"
    "              current_station_id: waiterServeStationId,\n"
    "              station_status: 'waiting',\n"
    "              station_started_at: null,\n"
    "              station_completed_at: now,\n"
    "            })\n"
    "            .in('id', dineInIds);\n"
    "          if (error) throw error;\n"
    "        }\n"
    "\n"
    "        // Dispatch non-dine_in items normally\n"
    "        if (otherIds.length > 0) {\n"
    "          const { error } = await supabase\n"
    "            .from('order_items')\n"
    "            .update({\n"
    "              current_station_id: null,\n"
    "              station_status: 'dispatched',\n"
    "              station_completed_at: now,\n"
    "            })\n"
    "            .in('id', otherIds);\n"
    "          if (error) throw error;\n"
    "        }\n"
    "\n"
    "        if (items && items.length > 0) {\n"
    "          // Fire-and-forget logs\n"
    "          const logs = items\n"
    "            .filter(i => i.current_station_id)\n"
    "            .map(i => ({\n"
    "              order_item_id: i.id,\n"
    "              station_id: i.current_station_id!,\n"
    "              action: 'dispatched',\n"
    "              performed_by: user.id,\n"
    "              tenant_id: i.tenant_id,\n"
    "            }));\n"
    "          if (logs.length > 0) {\n"
    "            supabase.from('kds_station_logs').insert(logs).then(() => {});\n"
    "          }\n"
    "\n"
    "          // Parallelize order completion checks\n"
    "          const orderIds = [...new Set(items.map(i => i.order_id))];\n"
    "          await Promise.all(\n"
    "            orderIds.map(orderId => supabase.rpc('check_order_completion', { _order_id: orderId }))\n"
    "          );\n"
    "        }\n"
    "        return true;\n"
    "      }\n"
    "      return invokeDeviceAction('dispatch_oven_items', { item_ids: itemIds });\n"
    "    },\n"
    "    onMutate: ({ itemIds }) => {\n"
    "      const idSet = new Set(itemIds);\n"
    "      const snapshots = snapshotAndPatch(\n"
    "        [['oven-items']],\n"
    "        (old) => old?.filter(i => !idSet.has(i.id))\n"
    "      );\n"
    "      return { snapshots };\n"
    "    },"
)

if old1 in actions:
    actions_new = actions.replace(old1, new1, 1)
    print("Patch 1 applied successfully")
else:
    print("ERROR: Patch 1 string NOT FOUND in useKdsActions.ts")
    idx = actions.find('dispatchOvenItems = useMutation')
    if idx >= 0:
        print(f"Found dispatchOvenItems at index {idx}, context:")
        print(repr(actions[idx:idx+400]))
    actions_new = None

# ---- PATCH 2: OvenKdsView.tsx ----
old2a = "import { useKdsActions } from '@/hooks/useKdsActions';"
new2a = "import { useKdsActions } from '@/hooks/useKdsActions';\nimport { useKdsStations } from '@/hooks/useKdsStations';"

old2b = "  const { markReady, dispatchOvenItems } = useKdsActions();"
new2b = "  const { markReady, dispatchOvenItems } = useKdsActions();\n  const { waiterServeStation } = useKdsStations();"

old2c = (
    "  const handleDispatch = useCallback((ids: string[]) => {\n"
    "    setDispatchedIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });\n"
    "    dispatchOvenItems.mutate(ids, {\n"
    "      onError: () => setDispatchedIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; }),\n"
    "    });\n"
    "  }, [dispatchOvenItems]);"
)

new2c = (
    "  const handleDispatch = useCallback((ids: string[]) => {\n"
    "    setDispatchedIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });\n"
    "    dispatchOvenItems.mutate({ itemIds: ids, waiterServeStationId: waiterServeStation?.id ?? null }, {\n"
    "      onError: () => setDispatchedIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; }),\n"
    "    });\n"
    "  }, [dispatchOvenItems, waiterServeStation]);"
)

oven_new = oven
patches_ok = True

if old2a in oven_new:
    oven_new = oven_new.replace(old2a, new2a, 1)
    print("Patch 2a applied successfully")
else:
    print("ERROR: Patch 2a string NOT FOUND in OvenKdsView.tsx")
    patches_ok = False

if old2b in oven_new:
    oven_new = oven_new.replace(old2b, new2b, 1)
    print("Patch 2b applied successfully")
else:
    print("ERROR: Patch 2b string NOT FOUND in OvenKdsView.tsx")
    patches_ok = False

if old2c in oven_new:
    oven_new = oven_new.replace(old2c, new2c, 1)
    print("Patch 2c applied successfully")
else:
    print("ERROR: Patch 2c string NOT FOUND in OvenKdsView.tsx")
    print("Looking for handleDispatch...")
    idx = oven_new.find('handleDispatch')
    if idx >= 0:
        print(repr(oven_new[idx:idx+400]))
    patches_ok = False

# Write files back only if all patches applied
if actions_new and patches_ok:
    with sftp.open('/var/www/slimpdv/src/hooks/useKdsActions.ts', 'w') as f:
        f.write(actions_new)
    print("useKdsActions.ts written back")

    with sftp.open('/var/www/slimpdv/src/components/kds/OvenKdsView.tsx', 'w') as f:
        f.write(oven_new)
    print("OvenKdsView.tsx written back")
    print("ALL PATCHES APPLIED SUCCESSFULLY")
else:
    print("ABORTED: Not all patches could be applied, files NOT written")

sftp.close()
ssh.close()
