#!/usr/bin/env python3
"""Fix: add all permissions to new owner on onboarding + fix existing owners with 0 perms."""
import paramiko, time

HOST = '72.61.25.92'
USER = 'root'
PASS = 'sshpass'

ALL_PERMISSIONS = [
    'dashboard_view','orders_view','orders_create','orders_edit','orders_cancel','orders_print',
    'tables_view','tables_close','tables_cancel_order','tables_cancel_items','tables_change_fees',
    'tables_reopen','tables_manage_payments','tables_reprint_items','tables_order_as_other',
    'tables_move_items','tables_switch',
    'menu_view','menu_manage',
    'stock_view','stock_add','stock_adjust','stock_manage','stock_view_movements',
    'cash_open','cash_close','cash_withdraw','cash_supply','cash_register_view','cash_register_manage','cash_view_difference',
    'reports_view','reports_export',
    'settings_general','settings_users','settings_print','settings_tables','settings_kds',
    'settings_notifications','settings_announcements','settings_idle_tables',
    'kds_view','kds_change_status',
    'counter_view','counter_add_items','counter_apply_discount','counter_process_payment',
    'delivery_view','delivery_manage',
    'customers_view','customers_manage',
    'audit_view','audit_export',
    'closing_history_view','closing_history_export',
    'reopen_history_view',
    'performance_view',
    'production_view','production_manage',
    'reservations_view','reservations_manage','reservations_cancel',
    'targets_manage',
    'approve_cancellation','approve_cash_reopen','approve_discount','approve_custom',
    'print_kitchen_ticket','print_customer_receipt','print_reprint',
]

def ssh_run(client, cmd, timeout=30):
    _, o, e = client.exec_command(cmd, timeout=timeout)
    out = o.read().decode('utf-8', errors='replace')
    err = e.read().decode('utf-8', errors='replace')
    if out.strip(): print(out.strip()[:500])
    if err.strip(): print('[E]', err.strip()[:200])
    return out

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASS)
    sftp = ssh.open_sftp()
    print('Connected.')

    # 1. Patch server.js onboarding route to grant all permissions on tenant creation
    perms_json = str(ALL_PERMISSIONS).replace("'", '"')

    patch_script = f'''
content = open('/var/www/slimpdv/backend/server.js').read()

# The anchor: right after user_roles insert in onboarding
anchor = "INSERT INTO user_roles (user_id, tenant_id, role) VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING",\\n      [userId, tenantId]\\n    );"

perms_code = """
    // Grant all permissions to owner
    const ALL_PERMISSIONS = {perms_json};
    if (ALL_PERMISSIONS.length > 0) {{
      const permValues = ALL_PERMISSIONS.map((p, i) => `($1, $2, ${{i * 2 + 3}}, true, $1)`).join(', ');
      const params = [userId, tenantId, ...ALL_PERMISSIONS];
      const placeholders = ALL_PERMISSIONS.map((_, i) => `($1, $2, ${{chr(36)}}{{i + 3}}, true, $1)`).join(', ');
      const permQ = 'INSERT INTO user_permissions (user_id, tenant_id, permission, granted, granted_by) VALUES ' + ALL_PERMISSIONS.map((_, i) => `($1, $2, ${{chr(36)}}{{i + 3}}, true, $1)`).join(', ') + ' ON CONFLICT (user_id, permission) DO UPDATE SET granted = true';
      await client.query(permQ, [userId, tenantId, ...ALL_PERMISSIONS]);
    }}"""

marker = '// PERMISSIONS_SEEDED'
if marker not in content:
    insert_after = "INSERT INTO user_roles (user_id, tenant_id, role) VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING",\\n      [userId, tenantId]\\n    );"
    # Find the position after the user_roles insert
    idx = content.find("INSERT INTO user_roles (user_id, tenant_id, role) VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING")
    if idx < 0:
        print("anchor not found!")
    else:
        # Find the closing paren of this query call
        end = content.find(');', idx) + 2
        insert_code = chr(10) + perms_code + chr(10) + '    ' + marker
        content = content[:end] + insert_code + content[end:]
        open('/var/www/slimpdv/backend/server.js', 'w').write(content)
        print('Patched onboarding with permissions seed')
else:
    print('Already patched')
'''

    perms_code_clean = f"""
    // Grant all permissions to new owner
    const _ALL_PERMS = {perms_json};
    if (_ALL_PERMS.length > 0) {{
      const _permQ = 'INSERT INTO user_permissions (user_id, tenant_id, permission, granted, granted_by) VALUES ' + _ALL_PERMS.map((_, i) => `($1, $2, $${{i + 3}}, true, $1)`).join(', ') + ' ON CONFLICT (user_id, permission) DO UPDATE SET granted = true';
      await client.query(_permQ, [userId, tenantId, ..._ALL_PERMS]);
    }}
    // PERMISSIONS_SEEDED
"""

    patch = f'''
import re
content = open('/var/www/slimpdv/backend/server.js').read()
marker = '// PERMISSIONS_SEEDED'
if marker in content:
    print('Already patched')
else:
    anchor = "INSERT INTO user_roles (user_id, tenant_id, role) VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING"
    idx = content.find(anchor)
    if idx < 0:
        print('anchor not found')
    else:
        end = content.find(');', idx) + 2
        insert = {repr(perms_code_clean)}
        content = content[:end] + insert + content[end:]
        open('/var/www/slimpdv/backend/server.js', 'w').write(content)
        print('Patched')
'''

    with sftp.open('/tmp/patch_perms.py', 'w') as f:
        f.write(patch)
    ssh_run(ssh, 'python3 /tmp/patch_perms.py')

    # 2. Fix existing owners who have 0 permissions
    perms_quoted = ', '.join(f"'{p}'" for p in ALL_PERMISSIONS)
    fix_existing = f"""
import subprocess, sys
perms = {repr(ALL_PERMISSIONS)}

# Get all owners with 0 permissions
query = \"\"\"
SELECT tm.user_id, tm.tenant_id
FROM tenant_members tm
LEFT JOIN user_permissions up ON up.user_id = tm.user_id
WHERE tm.is_owner = true
GROUP BY tm.user_id, tm.tenant_id
HAVING COUNT(up.id) = 0;
\"\"\"
result = subprocess.run(
    ['docker', 'exec', 'slimpdv-postgres', 'psql', '-U', 'slimpdv', '-d', 'slimpdv', '-t', '-c', query],
    capture_output=True, text=True
)
print('Owners with 0 perms:', result.stdout.strip())

rows = [r.strip() for r in result.stdout.strip().split('\\n') if '|' in r]
for row in rows:
    parts = [p.strip() for p in row.split('|')]
    if len(parts) < 2: continue
    user_id, tenant_id = parts[0], parts[1]
    for p in perms:
        ins = f"INSERT INTO user_permissions (user_id, tenant_id, permission, granted, granted_by) VALUES ('{user_id}', '{tenant_id}', '{p}', true, '{user_id}') ON CONFLICT (user_id, permission) DO UPDATE SET granted = true;"
        subprocess.run(['docker', 'exec', 'slimpdv-postgres', 'psql', '-U', 'slimpdv', '-d', 'slimpdv', '-c', ins], capture_output=True)
    print(f'Fixed permissions for user {{user_id}}')

print('Done fixing existing owners')
"""
    with sftp.open('/tmp/fix_existing.py', 'w') as f:
        f.write(fix_existing)
    ssh_run(ssh, 'python3 /tmp/fix_existing.py', timeout=60)

    # 3. Rebuild backend
    print('\n--- Rebuilding backend ---')
    ssh_run(ssh, 'cd /var/www/slimpdv && docker-compose build backend 2>&1 | tail -5', timeout=180)
    ssh_run(ssh, 'cd /var/www/slimpdv && docker-compose up -d backend', timeout=60)
    time.sleep(5)
    ssh_run(ssh, 'cd /var/www/slimpdv && docker-compose ps backend')

    # Verify
    ssh_run(ssh, 'docker exec slimpdv-postgres psql -U slimpdv -d slimpdv -c "SELECT p.email, COUNT(up.permission) as perms FROM profiles p LEFT JOIN user_permissions up ON up.user_id = p.id GROUP BY p.email ORDER BY perms DESC LIMIT 10;"')

    sftp.close()
    ssh.close()
    print('\nConcluído!')

if __name__ == '__main__':
    main()
