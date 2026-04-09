import paramiko
import time
import sys

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('72.61.25.92', username='root', password='sshpass')

def run(cmd, timeout=600):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    return out, err

print("Starting docker-compose build --no-cache frontend ...")
out, err = run('cd /var/www/slimpdv && docker-compose build --no-cache frontend 2>&1', timeout=600)
print("BUILD OUTPUT (last 5000 chars):")
print(out[-5000:] if len(out) > 5000 else out)
if err:
    print("STDERR:", err[-2000:])

print("\nStarting docker-compose up -d frontend ...")
out2, err2 = run('cd /var/www/slimpdv && docker-compose up -d frontend 2>&1', timeout=120)
print("UP OUTPUT:", out2)
if err2:
    print("STDERR:", err2)

print("\nWaiting 10s for container to start...")
time.sleep(10)

print("\nChecking container status...")
out3, err3 = run('docker ps --filter name=slimpdv_frontend --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"')
print(out3)

out4, err4 = run('docker logs --tail 20 $(docker ps -qf name=slimpdv_frontend) 2>&1')
print("Container logs (last 20 lines):")
print(out4)

ssh.close()
