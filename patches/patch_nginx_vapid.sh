#!/bin/sh
# patch_nginx_vapid.sh — injects VAPID public key as static nginx return
# Usage: patch_nginx_vapid.sh <vapid_public_key>
VAPID_KEY="$1"
CONF=/etc/nginx/conf.d/default.conf

if [ -z "$VAPID_KEY" ]; then
  echo "Usage: patch_nginx_vapid.sh <vapid_public_key>"
  exit 1
fi

if grep -q "vapid-public-key" "$CONF" 2>/dev/null; then
  echo "nginx VAPID already configured"
  exit 0
fi

if [ ! -f "$CONF" ]; then
  echo "nginx default.conf not found"
  exit 0
fi

cp "$CONF" "$CONF.bak"

# Build the two location blocks as a temp file to avoid quoting nightmares
# The nginx return 200 uses single-quoted JSON string
TMPBLOCK=/tmp/vapid_block.txt
printf '%s\n' \
  '    location = /api/push/vapid-public-key {' \
  '        add_header Content-Type "application/json";' \
  '        add_header Access-Control-Allow-Origin "*";' \
  "        return 200 '{\"publicKey\":\"${VAPID_KEY}\"}' ;" \
  '    }' \
  '    location = /push/vapid-public-key {' \
  '        add_header Content-Type "application/json";' \
  '        add_header Access-Control-Allow-Origin "*";' \
  "        return 200 '{\"publicKey\":\"${VAPID_KEY}\"}' ;" \
  '    }' \
  > "$TMPBLOCK"

# Use awk to insert the block after the first 'server {' line
awk -v block="$TMPBLOCK" '
/server[[:space:]]*\{/ && !done {
  print
  while ((getline line < block) > 0) print line
  close(block)
  done=1
  next
}
{ print }
' "$CONF" > /tmp/nginx_vapid_new.conf

if [ $? -ne 0 ]; then
  echo "awk failed — restoring backup"
  cp "$CONF.bak" "$CONF"
  exit 1
fi

mv /tmp/nginx_vapid_new.conf "$CONF"
echo "nginx VAPID locations injected"
