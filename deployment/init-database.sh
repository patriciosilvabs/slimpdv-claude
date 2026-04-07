#!/bin/bash

# SlimPDV Database Initialization Script
# This script imports the Supabase database dump into the local PostgreSQL instance
# Usage: ./init-database.sh <dump-file>

set -e

DUMP_FILE="${1:-.}"
DB_CONTAINER="slimpdv-postgres"
DB_NAME="slimpdv"
DB_USER="slimpdv"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
  echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1" >&2
  exit 1
}

warn() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if dump file is provided
if [ "$DUMP_FILE" = "." ]; then
  error "Please provide the Supabase dump file path as an argument"
  echo "Usage: ./init-database.sh /path/to/supabase_backup.sql"
fi

# Check if dump file exists
if [ ! -f "$DUMP_FILE" ]; then
  error "Dump file not found: $DUMP_FILE"
fi

log "Starting database initialization..."
log "Database container: $DB_CONTAINER"
log "Database name: $DB_NAME"
log "User: $DB_USER"
log "Dump file: $DUMP_FILE"

# Check if container is running
if ! docker ps | grep -q "$DB_CONTAINER"; then
  warn "Docker container $DB_CONTAINER is not running. Starting it..."
  docker-compose up -d postgres
  sleep 10
fi

# Wait for database to be ready
log "Waiting for database to be ready..."
for i in {1..30}; do
  if docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" >/dev/null 2>&1; then
    log "Database is ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    error "Database failed to become ready"
  fi
  echo -n "."
  sleep 1
done

# Import dump
log "Importing database dump..."
if file "$DUMP_FILE" | grep -q "gzip"; then
  log "Detected gzip compressed dump"
  gunzip -c "$DUMP_FILE" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"
else
  log "Importing uncompressed SQL dump"
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$DUMP_FILE"
fi

# Verify import
log "Verifying import..."
TABLE_COUNT=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")

if [ -z "$TABLE_COUNT" ] || [ "$TABLE_COUNT" -lt 5 ]; then
  error "Import verification failed. Expected at least 5 tables, found: $TABLE_COUNT"
fi

log "Database import successful! Found $TABLE_COUNT tables"

# Show database statistics
log "Database statistics:"
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT schemaname, COUNT(*) as tables FROM pg_tables WHERE schemaname = 'public' GROUP BY schemaname;"

docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT COUNT(*) as users FROM profiles;" 2>/dev/null || warn "Could not count users (table might not exist yet)"

log "Database initialization completed successfully!"
log ""
log "Next steps:"
echo "  1. Verify the imported data: docker-compose exec postgres psql -U slimpdv -d slimpdv"
echo "  2. Test the backend connection: docker-compose logs backend"
echo "  3. Run the application: docker-compose up -d"
