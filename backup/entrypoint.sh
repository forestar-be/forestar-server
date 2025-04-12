#!/bin/bash
set -e

echo "Configuring backup service..."

# Check if BACKUP_GDRIVE_FOLDER_ID is set
if [ -z "$BACKUP_GDRIVE_FOLDER_ID" ]; then
  echo "ERROR: BACKUP_GDRIVE_FOLDER_ID is not set."
  echo "Cannot proceed without backup folder ID."
  exit 1
fi

# Check if service key file exists (KEY_FILE)
if [ -n "$KEY_FILE" ] && [ -f "$KEY_FILE" ]; then
  echo "Using existing service account file at $KEY_FILE"
  export SERVICE_ACCOUNT_FILE="$KEY_FILE"
# Otherwise, check other authentication methods
elif [ -n "$GOOGLE_SERVICE_ACCOUNT" ]; then
  echo "Creating service account file from environment variable..."
  mkdir -p /root/.google
  echo "$GOOGLE_SERVICE_ACCOUNT" > /root/.google/service-account.json
  export SERVICE_ACCOUNT_FILE="/root/.google/service-account.json"
elif [ -n "$GOOGLE_SERVICE_ACCOUNT_FILE" ] && [ -f "$GOOGLE_SERVICE_ACCOUNT_FILE" ]; then
  echo "Using alternative service account file..."
  export SERVICE_ACCOUNT_FILE="$GOOGLE_SERVICE_ACCOUNT_FILE"
fi

# Configure rclone if needed
if [ ! -f "/root/.config/rclone/rclone.conf" ]; then
  echo "Configuring rclone..."
  /app/scripts/rclone_setup.sh
fi

# Check PostgreSQL environment variables
if [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_PASSWORD" ] || [ -z "$POSTGRES_DB" ]; then
  echo "WARNING: POSTGRES_USER, POSTGRES_PASSWORD or POSTGRES_DB variables are not set."
  echo "Database backup might fail."
fi

echo "Starting custom scheduler..."
# Initial backup execution if option is enabled
if [ "${RUN_BACKUP_ON_STARTUP}" = "true" ]; then
  echo "Running initial backup..."
  /app/scripts/backup.sh
fi

# Start custom scheduler in the foreground
exec /app/scripts/scheduler.sh 