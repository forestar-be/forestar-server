#!/bin/bash
set -e

# Script to create an SSH tunnel to port 9443
# Usage: ./portainer-tunnel.sh [username] [server] [local_port] [remote_port]

# Output colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
USERNAME=${1:-"root"}
SERVER=${2:-"serveur.forestar-shop-atelier.be"}
LOCAL_PORT=${3:-9443}
REMOTE_PORT=${4:-9443}

# Log functions
log() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Display usage information
usage() {
  echo "Usage: $0 [username] [server] [local_port] [remote_port]"
  echo "  username    - SSH username (default: root)"
  echo "  server      - Remote server address (default: serveur.forestar-shop-atelier.be)"
  echo "  local_port  - Local port to forward (default: 9443)"
  echo "  remote_port - Remote port to connect to (default: 9443)"
  echo ""
  echo "Examples:"
  echo "  $0                                # Use defaults"
  echo "  $0 admin example.com              # Custom username and server"
  echo "  $0 user server.com 8080           # Custom local port"
  echo "  $0 user server.com 8080 9000      # Custom local and remote ports"
}

# Check for help flag
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
  usage
  exit 0
fi

# Create the SSH tunnel
create_tunnel() {
  log "Creating SSH tunnel from localhost:${LOCAL_PORT} to ${SERVER}:${REMOTE_PORT}"
  log "Press Ctrl+C to stop the tunnel"
  
  # -L is for local port forwarding
  # -N means don't execute a remote command (tunnel only)
  # -f runs in background (comment out to run in foreground)
  # -v for verbose output
  ssh -L ${LOCAL_PORT}:localhost:${REMOTE_PORT} ${USERNAME}@${SERVER} -N -v
  
  # The tunnel will remain active until the script is terminated
}

# Check if SSH is available
if ! command -v ssh &> /dev/null; then
  error "SSH client is not installed. Please install SSH before continuing."
  exit 1
fi

# Create the tunnel
create_tunnel

# Exit message - this will only be reached if the tunnel is terminated
log "SSH tunnel terminated."