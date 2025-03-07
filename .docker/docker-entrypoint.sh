#!/bin/sh
set -e

# Debug: Print environment variables to help troubleshoot
echo "==== Environment Variables ===="
echo "DATABASE_URL: $DATABASE_URL"
echo "============================="

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set!"
  exit 1
fi

# Extract the database URL without schema and the schema name
DATABASE_URL_WITHOUT_SCHEMA=${DATABASE_URL%?schema=*}
SCHEMA_NAME=$(echo $DATABASE_URL | grep -o 'schema=\w\+' | cut -d= -f2)

echo "Using schema: $SCHEMA_NAME"
echo "Database URL without schema: $DATABASE_URL_WITHOUT_SCHEMA"

# Check if SCHEMA_NAME was extracted correctly
if [ -z "$SCHEMA_NAME" ]; then
  echo "ERROR: Could not extract schema name from DATABASE_URL!"
  exit 1
fi

echo "Dropping views..."
psql $DATABASE_URL_WITHOUT_SCHEMA -c "SET search_path TO $SCHEMA_NAME; DROP VIEW IF EXISTS \"MachineRentalView\", \"MachineRentedView\" CASCADE;"

echo "Running migrations..."
npx prisma migrate deploy

echo "Applying views..."
for view_file in ./prisma/views/create_scripts/*.sql; do
  echo "Applying view: $view_file"
  psql $DATABASE_URL_WITHOUT_SCHEMA -c "SET search_path TO $SCHEMA_NAME;" -f "$view_file"
done

echo "Starting application..."
exec npm start