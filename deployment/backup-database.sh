#!/bin/bash

# SlimPDV Database Backup Script
# Usage: ./backup-database.sh
# Or schedule with cron: 0 2 * * * /path/to/backup-database.sh

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/slimpdv}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
LOG_FILE="${LOG_FILE:-/var/log/slimpdv-backup.log}"
DB_CONTAINER="${DB_CONTAINER:-slimpdv-postgres}"
DB_NAME="${DB_NAME:-slimpdv}"
DB_USER="${DB_USER:-slimpdv}"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Logging function
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handler
on_error() {
  log "ERROR: Backup failed at line $1"
  exit 1
}

trap 'on_error $LINENO' ERR

# Start backup
log "Starting database backup..."
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/slimpdv_$TIMESTAMP.sql.gz"

# Check if container is running
if ! docker ps | grep -q "$DB_CONTAINER"; then
  log "ERROR: Docker container $DB_CONTAINER is not running"
  exit 1
fi

# Create backup
log "Creating backup: $BACKUP_FILE"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

# Check backup size
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log "Backup completed successfully. Size: $SIZE"

# Cleanup old backups
log "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "slimpdv_*.sql.gz" -mtime "+$RETENTION_DAYS" -delete

# List recent backups
log "Recent backups:"
ls -lh "$BACKUP_DIR"/slimpdv_*.sql.gz 2>/dev/null | tail -5 | tee -a "$LOG_FILE"

log "Backup process completed successfully"
