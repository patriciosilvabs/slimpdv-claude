#!/usr/bin/env python3
"""Deploy plans management: backend routes + frontend rebuild."""
import paramiko
import sys
import time

HOST = '72.61.25.92'
USER = 'root'
PASS = 'sshpass'

def ssh_run(client, cmd, timeout=120):
    print(f'$ {cmd[:100]}')
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out.strip(): print(out.strip())
    if err.strip(): print('[ERR]', err.strip()[:300])
    return out

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASS)
    sftp = ssh.open_sftp()
    print('Connected.')

    # 1. Upload plans_routes.js
    sftp.put(
        r'C:\Users\julie\Downloads\slimpdv-main\backend\plans_routes.js',
        '/var/www/slimpdv/backend/plans_routes.js'
    )
    print('Uploaded plans_routes.js')

    # Upload updated frontend files
    files_to_upload = [
        (r'C:\Users\julie\Downloads\slimpdv-main\src\pages\platform\PlatformPlans.tsx',
         '/var/www/slimpdv/src/pages/platform/PlatformPlans.tsx'),
        (r'C:\Users\julie\Downloads\slimpdv-main\src\components\platform\PlatformLayout.tsx',
         '/var/www/slimpdv/src/components/platform/PlatformLayout.tsx'),
        (r'C:\Users\julie\Downloads\slimpdv-main\src\App.tsx',
         '/var/www/slimpdv/src/App.tsx'),
    ]
    for local, remote in files_to_upload:
        sftp.put(local, remote)
        print(f'Uploaded {remote}')

    # 2. Inject plans_routes.js into server.js if not already there
    check = ssh_run(ssh, "grep -c 'api/admin/plans' /var/www/slimpdv/backend/server.js || true")
    count = int(check.strip()) if check.strip().isdigit() else 0
    if count == 0:
        inject_cmd = r"""python3 -c "
content = open('/var/www/slimpdv/backend/server.js').read()
marker = '// END PLANS_ROUTES'
if marker not in content:
    routes = open('/var/www/slimpdv/backend/plans_routes.js').read()
    insert_before = 'app.listen'
    idx = content.rfind(insert_before)
    if idx >= 0:
        content = content[:idx] + routes + chr(10) + marker + chr(10) + chr(10) + content[idx:]
        open('/var/www/slimpdv/backend/server.js', 'w').write(content)
        print('Injected plans routes')
    else:
        print('ERROR: app.listen not found')
else:
    print('Already injected')
" """
        ssh_run(ssh, inject_cmd)
    else:
        print('Plans routes already in server.js')

    # 3. Rebuild backend container
    print('\n--- Rebuilding backend ---')
    ssh_run(ssh, 'cd /var/www/slimpdv && docker-compose build backend 2>&1 | tail -5', timeout=180)
    ssh_run(ssh, 'cd /var/www/slimpdv && docker-compose up -d backend', timeout=60)
    time.sleep(5)
    ssh_run(ssh, 'cd /var/www/slimpdv && docker-compose ps backend')

    # 4. Rebuild frontend
    print('\n--- Rebuilding frontend ---')
    ssh_run(ssh, 'cd /var/www/slimpdv && docker-compose build frontend 2>&1 | tail -10', timeout=300)
    ssh_run(ssh, 'cd /var/www/slimpdv && docker-compose up -d frontend', timeout=60)
    time.sleep(5)
    ssh_run(ssh, 'cd /var/www/slimpdv && docker-compose ps frontend')

    print('\nDeploy concluido!')
    sftp.close()
    ssh.close()

if __name__ == '__main__':
    main()
