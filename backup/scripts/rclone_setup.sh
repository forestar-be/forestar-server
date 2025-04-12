#!/bin/bash
set -e

# Create rclone configuration directory
mkdir -p /root/.config/rclone

# Check if a config file already exists
if [ -f "/root/.config/rclone/rclone.conf" ]; then
  echo "A rclone configuration file already exists, it will not be overwritten."
  exit 0
fi

# Priority to service account if it exists
if [ -f "$SERVICE_ACCOUNT_FILE" ]; then
  echo "Using Google service account found at $SERVICE_ACCOUNT_FILE"
  
  # Create rclone configuration with service account
  cat > /root/.config/rclone/rclone.conf << EOF
[gdrive]
type = drive
scope = drive
service_account_file = $SERVICE_ACCOUNT_FILE
EOF
  echo "rclone configuration successfully created with service account."
  
# Otherwise use OAuth credentials if available
elif [ -n "$GDRIVE_CLIENT_ID" ] && [ -n "$GDRIVE_CLIENT_SECRET" ] && [ -n "$GDRIVE_REFRESH_TOKEN" ]; then
  echo "Using OAuth credentials"
  
  # Create rclone configuration file with refresh token
  cat > /root/.config/rclone/rclone.conf << EOF
[gdrive]
type = drive
client_id = ${GDRIVE_CLIENT_ID}
client_secret = ${GDRIVE_CLIENT_SECRET}
scope = drive
token = {"access_token":"","token_type":"Bearer","refresh_token":"${GDRIVE_REFRESH_TOKEN}","expiry":"2023-01-01T00:00:00.000000000Z"}
EOF
  echo "rclone configuration successfully created using OAuth refresh token."
else
  echo "ERROR: No authentication method available."
  echo "Please set either SERVICE_ACCOUNT_FILE or GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET and GDRIVE_REFRESH_TOKEN."
  echo "You can also run the following command in the container to manually configure rclone:"
  echo "docker exec -it backup rclone config"
  exit 1
fi

# Check that the configuration works
if rclone --config=/root/.config/rclone/rclone.conf lsf gdrive: &>/dev/null; then
  echo "rclone configuration is working correctly."
else
  echo "ERROR: rclone configuration is not working. Please check your credentials."
  exit 1
fi 