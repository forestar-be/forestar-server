#!/bin/bash
set -e

# Custom scheduler to replace cron
# Runs daily backup at 2 AM

LOG_FILE="/backup/scheduler.log"

echo "$(date): Starting custom scheduler" | tee -a $LOG_FILE

# Function to run backup
run_backup() {
  echo "$(date): Running backup..." | tee -a $LOG_FILE
  # Execute backup script and redirect all logs
  /app/scripts/backup.sh 2>&1 | tee -a $LOG_FILE
  echo "$(date): Backup completed" | tee -a $LOG_FILE
}

# Function to check if it's time to run backup (2 AM)
should_run_backup() {
  local hour=$(date +%H)
  local minute=$(date +%M)
  
  # If time is 2 AM and minutes are between 0 and 5
  if [ "$hour" = "02" ] && [ "$minute" -ge "0" ] && [ "$minute" -le "5" ]; then
    return 0  # true in bash
  fi
  return 1  # false in bash
}

# Flag to track if backup has been run today
BACKUP_RUN_TODAY=$(date +%Y%m%d)
BACKUP_DONE=false

echo "$(date): Scheduler initialized, waiting for next execution at 2:00 AM" | tee -a $LOG_FILE

# Main loop
while true; do
  # Check if date has changed (new day)
  CURRENT_DATE=$(date +%Y%m%d)
  if [ "$CURRENT_DATE" != "$BACKUP_RUN_TODAY" ]; then
    BACKUP_RUN_TODAY=$CURRENT_DATE
    BACKUP_DONE=false
    echo "$(date): New day detected, waiting for execution at 2:00 AM" | tee -a $LOG_FILE
  fi
  
  # Check if it's time to run backup (and if it hasn't already been run today)
  if should_run_backup && [ "$BACKUP_DONE" = "false" ]; then
    run_backup
    BACKUP_DONE=true
    echo "$(date): Backup marked as completed for today" | tee -a $LOG_FILE
  fi
  
  # Heartbeat to indicate scheduler is still running
  if [ "$(date +%M)" = "00" ]; then  # Log every hour
    echo "$(date): Scheduler running..." | tee -a $LOG_FILE
  fi
  
  # Wait 1 minute before checking again
  sleep 60
done 