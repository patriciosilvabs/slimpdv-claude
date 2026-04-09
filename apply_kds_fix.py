import paramiko
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('72.61.25.92', username='root', password='sshpass')

def run(cmd, timeout=300):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode()
    err = stderr.read().decode()
    return out, err

# Read current file
sftp = ssh.open_sftp()
with sftp.open('/var/www/slimpdv/src/hooks/useKdsWorkflow.ts', 'r') as f:
    current = f.read().decode('utf-8')
sftp.close()

print(f"Read {len(current)} bytes, {current.count(chr(10))} lines")

# ---- Replacement 1 ----
find1 = (
    "    // SEQUENTIAL mode (default): follow productionStations by sort_order\n"
    "    const next = getNextStation(currentStationId);\n"
    "    if (next) return { id: next.id, type: next.station_type };\n"
    "\n"
    "    // Last production station \u2192 order_status or done\n"
    "    if (orderStatusStation) return { id: orderStatusStation.id, type: 'order_status' };\n"
    "    return null;\n"
    "  };"
)

replace1 = (
    "    // SEQUENTIAL mode (default): follow productionStations by sort_order\n"
    "    const next = getNextStation(currentStationId);\n"
    "    if (next) return { id: next.id, type: next.station_type };\n"
    "\n"
    "    // Last production station \u2192 order_status, then waiter_serve (dine_in), or done\n"
    "    if (orderStatusStation) return { id: orderStatusStation.id, type: 'order_status' };\n"
    "    // Sem order_status: pedidos de mesa v\u00e3o direto para o gar\u00e7om\n"
    "    if (waiterServeStation && orderType === 'dine_in') {\n"
    "      return { id: waiterServeStation.id, type: 'waiter_serve' };\n"
    "    }\n"
    "    return null;\n"
    "  };"
)

count1 = current.count(find1)
print(f"Replacement 1: found {count1} occurrence(s)")
if count1 == 1:
    current = current.replace(find1, replace1)
    print("  Applied OK")
else:
    idx = current.find("Last production station")
    if idx != -1:
        print("  Context around 'Last production station':")
        print(repr(current[idx-100:idx+300]))
    else:
        print("  'Last production station' not found at all")

# ---- Replacement 2 ----
find2 = (
    "      if (currentStation.station_type === 'prep_start' || currentStation.is_edge_sector) {\n"
    "        const prepId = await findLeastBusyPrepStation();\n"
    "        if (prepId) return { id: prepId, type: 'item_assembly' };\n"
    "        if (orderStatusStation) return { id: orderStatusStation.id, type: 'order_status' };\n"
    "        return null;\n"
    "      }\n"
    "      if (currentStation.station_type === 'item_assembly') {\n"
    "        // After assembly, go to next station (oven/dispatch) or order_status\n"
    "        const next = getNextStation(currentStationId);\n"
    "        if (next) return { id: next.id, type: next.station_type };\n"
    "        if (orderStatusStation) return { id: orderStatusStation.id, type: 'order_status' };\n"
    "        return null;\n"
    "      }"
)

replace2 = (
    "      if (currentStation.station_type === 'prep_start' || currentStation.is_edge_sector) {\n"
    "        const prepId = await findLeastBusyPrepStation();\n"
    "        if (prepId) return { id: prepId, type: 'item_assembly' };\n"
    "        if (orderStatusStation) return { id: orderStatusStation.id, type: 'order_status' };\n"
    "        if (waiterServeStation && orderType === 'dine_in') return { id: waiterServeStation.id, type: 'waiter_serve' };\n"
    "        return null;\n"
    "      }\n"
    "      if (currentStation.station_type === 'item_assembly') {\n"
    "        // After assembly, go to next station (oven/dispatch) or order_status\n"
    "        const next = getNextStation(currentStationId);\n"
    "        if (next) return { id: next.id, type: next.station_type };\n"
    "        if (orderStatusStation) return { id: orderStatusStation.id, type: 'order_status' };\n"
    "        if (waiterServeStation && orderType === 'dine_in') return { id: waiterServeStation.id, type: 'waiter_serve' };\n"
    "        return null;\n"
    "      }"
)

count2 = current.count(find2)
print(f"Replacement 2: found {count2} occurrence(s)")
if count2 == 1:
    current = current.replace(find2, replace2)
    print("  Applied OK")
else:
    idx = current.find("findLeastBusyPrepStation")
    if idx != -1:
        print("  Context around 'findLeastBusyPrepStation':")
        print(repr(current[idx-50:idx+400]))

# ---- Replacement 3 ----
find3 = (
    "      if (currentStation?.station_type === 'order_status') {\n"
    "        // For order_status stations, only dine_in goes to next order_status\n"
    "        if (orderType === 'dine_in') {\n"
    "          const nextOrderStatus = orderStatusStations\n"
    "            ?.filter(s => s.is_active && (s.sort_order ?? 0) > (currentStation.sort_order ?? 0))\n"
    "            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];\n"
    "          targetStationId = nextOrderStatus?.id || null;\n"
    "        }\n"
    "        // delivery/takeaway \u2192 null (done)\n"
    "      } else {\n"
    "        const nextStation = getNextStation(currentStationId);\n"
    "        targetStationId = nextStation?.id || orderStatusStation?.id || null;\n"
    "      }"
)

replace3 = (
    "      if (currentStation?.station_type === 'order_status') {\n"
    "        // For order_status stations: dine_in \u2192 waiter_serve or next order_status\n"
    "        if (orderType === 'dine_in') {\n"
    "          if (waiterServeStation) {\n"
    "            targetStationId = waiterServeStation.id;\n"
    "          } else {\n"
    "            const nextOrderStatus = orderStatusStations\n"
    "              ?.filter(s => s.is_active && (s.sort_order ?? 0) > ((currentStation.sort_order ?? 0)))\n"
    "              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];\n"
    "            targetStationId = nextOrderStatus?.id || null;\n"
    "          }\n"
    "        }\n"
    "        // delivery/takeaway \u2192 null (done)\n"
    "      } else {\n"
    "        const nextStation = getNextStation(currentStationId);\n"
    "        if (nextStation) {\n"
    "          targetStationId = nextStation.id;\n"
    "        } else if (orderStatusStation) {\n"
    "          targetStationId = orderStatusStation.id;\n"
    "        } else if (waiterServeStation && orderType === 'dine_in') {\n"
    "          targetStationId = waiterServeStation.id;\n"
    "        } else {\n"
    "          targetStationId = null;\n"
    "        }\n"
    "      }"
)

count3 = current.count(find3)
print(f"Replacement 3: found {count3} occurrence(s)")
if count3 == 1:
    current = current.replace(find3, replace3)
    print("  Applied OK")
else:
    idx = current.find("order_status stations, only dine_in")
    if idx != -1:
        print("  Context around match:")
        print(repr(current[idx-50:idx+500]))
    else:
        idx = current.find("order_status stations")
        if idx != -1:
            print("  Context:")
            print(repr(current[idx-50:idx+500]))
        else:
            print("  Not found")

# ---- Replacement 4 ----
find4 = (
    "        // Se tiver esta\u00e7\u00e3o de status do pedido, mover o item para l\u00e1\n"
    "        if (orderStatusStation) {\n"
    "          const { error } = await supabase\n"
    "            .from('order_items')\n"
    "            .update({\n"
    "              current_station_id: orderStatusStation.id,\n"
    "              station_status: 'waiting',\n"
    "              station_started_at: null,\n"
    "              station_completed_at: now,\n"
    "            })\n"
    "            .eq('id', itemId);\n"
    "\n"
    "          if (error) throw error;\n"
    "\n"
    "          // Log fire-and-forget\n"
    "          logAction.mutateAsync({\n"
    "            orderItemId: itemId,\n"
    "            stationId: orderStatusStation.id,\n"
    "            action: 'entered',\n"
    "          }).catch(() => {});\n"
    "        } else {\n"
    "          // Sem esta\u00e7\u00e3o de status - marcar item como done diretamente\n"
    "          const { error } = await supabase\n"
    "            .from('order_items')\n"
    "            .update({\n"
    "              current_station_id: null,\n"
    "              station_status: 'done',\n"
    "              station_completed_at: now,\n"
    "              status: 'delivered',\n"
    "            })\n"
    "            .eq('id', itemId);\n"
    "\n"
    "          if (error) throw error;\n"
    "        }"
)

replace4 = (
    "        // Determinar pr\u00f3ximo destino: order_status \u2192 waiter_serve (dine_in) \u2192 done\n"
    "        const { data: itemOrderData } = await supabase\n"
    "          .from('order_items')\n"
    "          .select('order_id, order:orders(order_type)')\n"
    "          .eq('id', itemId)\n"
    "          .single();\n"
    "        const itemOrderType = (itemOrderData?.order as { order_type?: string } | null)?.order_type;\n"
    "\n"
    "        if (orderStatusStation) {\n"
    "          const { error } = await supabase\n"
    "            .from('order_items')\n"
    "            .update({\n"
    "              current_station_id: orderStatusStation.id,\n"
    "              station_status: 'waiting',\n"
    "              station_started_at: null,\n"
    "              station_completed_at: now,\n"
    "            })\n"
    "            .eq('id', itemId);\n"
    "\n"
    "          if (error) throw error;\n"
    "\n"
    "          logAction.mutateAsync({\n"
    "            orderItemId: itemId,\n"
    "            stationId: orderStatusStation.id,\n"
    "            action: 'entered',\n"
    "          }).catch(() => {});\n"
    "        } else if (waiterServeStation && itemOrderType === 'dine_in') {\n"
    "          // Sem order_status mas existe gar\u00e7om: pedidos de mesa v\u00e3o para passa-prato\n"
    "          const { error } = await supabase\n"
    "            .from('order_items')\n"
    "            .update({\n"
    "              current_station_id: waiterServeStation.id,\n"
    "              station_status: 'waiting',\n"
    "              station_started_at: null,\n"
    "              station_completed_at: now,\n"
    "            })\n"
    "            .eq('id', itemId);\n"
    "\n"
    "          if (error) throw error;\n"
    "\n"
    "          logAction.mutateAsync({\n"
    "            orderItemId: itemId,\n"
    "            stationId: waiterServeStation.id,\n"
    "            action: 'entered',\n"
    "          }).catch(() => {});\n"
    "        } else {\n"
    "          // Sem esta\u00e7\u00e3o de status nem gar\u00e7om - marcar item como done diretamente\n"
    "          const { error } = await supabase\n"
    "            .from('order_items')\n"
    "            .update({\n"
    "              current_station_id: null,\n"
    "              station_status: 'done',\n"
    "              station_completed_at: now,\n"
    "              status: 'delivered',\n"
    "            })\n"
    "            .eq('id', itemId);\n"
    "\n"
    "          if (error) throw error;\n"
    "        }"
)

count4 = current.count(find4)
print(f"Replacement 4: found {count4} occurrence(s)")
if count4 == 1:
    current = current.replace(find4, replace4)
    print("  Applied OK")
else:
    idx = current.find("Se tiver esta")
    if idx != -1:
        print("  Context:")
        print(repr(current[idx-50:idx+600]))
    else:
        print("  Substring 'Se tiver esta' not found")

print(f"\nFinal file: {len(current)} bytes, {current.count(chr(10))} lines")

# Write modified version back to VPS
sftp2 = ssh.open_sftp()
with sftp2.open('/var/www/slimpdv/src/hooks/useKdsWorkflow.ts', 'w') as f:
    f.write(current.encode('utf-8'))
sftp2.close()
print("Written back to VPS OK")

ssh.close()
