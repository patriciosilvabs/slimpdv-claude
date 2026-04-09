import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('72.61.25.92', username='root', password='sshpass')

def run(cmd, timeout=300):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    return stdout.read().decode(), stderr.read().decode()

content = open(r'C:\Users\julie\Downloads\slimpdv-main\KdsWaiterServePanel.tsx', 'r', encoding='utf-8').read()

sftp = ssh.open_sftp()
with sftp.open('/var/www/slimpdv/src/components/kds/KdsWaiterServePanel.tsx', 'w') as f:
    f.write(content)

print("File written OK")
out, err = run('wc -l /var/www/slimpdv/src/components/kds/KdsWaiterServePanel.tsx')
print("Lines:", out.strip())

sftp.close()
ssh.close()
