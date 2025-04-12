#!/bin/bash
set -e

# Variables
BACKUP_DIR="/backup"
DATE=$(date +%Y%m%d)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_${TIMESTAMP}"
BACKUP_FOLDER="${BACKUP_DIR}/${BACKUP_NAME}"
GDRIVE_FOLDER_ID="${BACKUP_GDRIVE_FOLDER_ID}"

# Create backup directory
mkdir -p ${BACKUP_FOLDER}

# Log actions
echo "$(date): Backup started" | tee -a ${BACKUP_DIR}/backup.log

# Database dump
echo "$(date): Dumping PostgreSQL database" | tee -a ${BACKUP_DIR}/backup.log
if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "WARNING: POSTGRES_PASSWORD variable not defined. Using system authentication." | tee -a ${BACKUP_DIR}/backup.log
fi

PGPASSWORD=${POSTGRES_PASSWORD} pg_dump -h db -U ${POSTGRES_USER} -d ${POSTGRES_DB} -F c -f ${BACKUP_FOLDER}/database_${TIMESTAMP}.dump
echo "$(date): Database dump completed" | tee -a ${BACKUP_DIR}/backup.log

# Nginx configuration backup
echo "$(date): Backing up Nginx configuration" | tee -a ${BACKUP_DIR}/backup.log
if [ -d "/mnt/nginx_conf" ]; then
  tar -czf ${BACKUP_FOLDER}/nginx_conf_${TIMESTAMP}.tar.gz -C /mnt/nginx_conf .
  echo "$(date): Nginx configuration backup completed" | tee -a ${BACKUP_DIR}/backup.log
else
  echo "WARNING: Nginx configuration directory not found" | tee -a ${BACKUP_DIR}/backup.log
fi

# Host data directory backup
echo "$(date): Backing up host data directory" | tee -a ${BACKUP_DIR}/backup.log
if [ -d "/mnt/host_data" ]; then
  tar -czf ${BACKUP_FOLDER}/host_data_${TIMESTAMP}.tar.gz -C /mnt/host_data .
  echo "$(date): Host data directory backup completed" | tee -a ${BACKUP_DIR}/backup.log
else
  echo "WARNING: Host data directory not found" | tee -a ${BACKUP_DIR}/backup.log
fi

# Create complete archive
echo "$(date): Creating complete archive" | tee -a ${BACKUP_DIR}/backup.log
tar -czf ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz -C ${BACKUP_DIR} ${BACKUP_NAME}
echo "$(date): Complete archive creation finished" | tee -a ${BACKUP_DIR}/backup.log

# Upload to Google Drive with rclone
echo "$(date): Uploading backup to Google Drive" | tee -a ${BACKUP_DIR}/backup.log
if rclone --config=/root/.config/rclone/rclone.conf lsf gdrive: &>/dev/null; then
  rclone --config=/root/.config/rclone/rclone.conf copy ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz gdrive: --drive-root-folder-id=${GDRIVE_FOLDER_ID}
  echo "$(date): Google Drive upload completed" | tee -a ${BACKUP_DIR}/backup.log
else
  echo "ERROR: rclone configuration for Google Drive not found or invalid" | tee -a ${BACKUP_DIR}/backup.log
fi

# Clean up old backups (keep last 7 days)
echo "$(date): Cleaning up old local backups" | tee -a ${BACKUP_DIR}/backup.log
find ${BACKUP_DIR} -name "backup_*" -type d -mtime +7 -exec rm -rf {} \; 2>/dev/null || true
find ${BACKUP_DIR} -name "backup_*.tar.gz" -type f -mtime +7 -exec rm -f {} \; 2>/dev/null || true

# Clean up old Google Drive backups (keep last 30 days)
echo "$(date): Cleaning up old Google Drive backups" | tee -a ${BACKUP_DIR}/backup.log
if rclone --config=/root/.config/rclone/rclone.conf lsf gdrive: &>/dev/null; then
  # List files older than 30 days and delete them
  rclone --config=/root/.config/rclone/rclone.conf delete --min-age 30d gdrive: --drive-root-folder-id=${GDRIVE_FOLDER_ID}
  echo "$(date): Google Drive backup cleanup completed" | tee -a ${BACKUP_DIR}/backup.log
fi

echo "$(date): Backup completed successfully" | tee -a ${BACKUP_DIR}/backup.log 