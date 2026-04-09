import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('72.61.25.92', username='root', password='sshpass')

def run(cmd, timeout=30):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    return out, err

out, err = run('docker ps --filter name=slimpdv-frontend --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"')
print("Container status:")
print(out)

out2, err2 = run('docker logs --tail 20 slimpdv-frontend 2>&1')
print("Last 20 log lines:")
print(out2)

ssh.close()
