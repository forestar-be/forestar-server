# Forestar Server

## License - All rights reserved

This software is licensed under a restricted license. Permission is only granted to Joel Yernault & Charles HL (@Charles-HL) to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of this software. All other individuals or entities are explicitly prohibited from using, copying, modifying, merging, publishing, distributing, sublicensing, and/or selling copies of the software, unless they receive prior written consent from the copyright holder.

Unauthorized use of the software is strictly prohibited. For more details, please refer to the [LICENSE](LICENSE) file.

## Self-Hosted Deployment Guide

This guide will help you set up the Forestar server on a self-hosted OVH VPS using Docker and GitHub Actions for deployment.

### Prerequisites

- OVH VPS with Docker and Docker Compose installed
- SSH access to the VPS
- GitHub repository with GitHub Actions enabled
- PostgreSQL database (will be set up with Docker Compose)

### Setup

1. **Set up GitHub Secrets**

   Add the following secrets to your GitHub repository:

   **SSH and Deployment Secrets:**

   - `SSH_PRIVATE_KEY`: Your private SSH key for connecting to the VPS
   - `SSH_USER`: SSH username for the VPS
   - `VPS_HOST`: The hostname or IP address of your VPS
   - `PROJECT_PATH`: The path where the project will be deployed (e.g., `/home/user/forestar-server`)

   **Database Secrets:**

   - `POSTGRES_USER`: PostgreSQL database username
   - `POSTGRES_PASSWORD`: PostgreSQL database password
   - `POSTGRES_DB`: PostgreSQL database name

   **Application Secrets:**

   - `FRONTEND_URL`: URL of the frontend application
   - `API_URL`: URL of the API
   - `TO_EMAIL`: Email address for receiving notifications
   - `AUTH_TOKEN`: Authentication token
   - `API_KEY_BREVO`: Brevo API key
   - `SECRET_KEY`: Secret key for JWT tokens
   - `SUPERVISOR_SECRET_KEY`: Secret key for supervisor authentication
   - `RENTAL_MANAGER_SECRET_KEY`: Secret key for rental manager authentication
   - `ADMIN_SECRET_KEY`: Secret key for admin authentication
   - `EMAIL_SERVICE`: Email service provider
   - `EMAIL_USER`: Email service username
   - `EMAIL_PASS`: Email service password
   - `REPLY_TO`: Reply-to email address
   - `DRIVE_FOLDER_ID`: Google Drive folder ID
   - `GOOGLE_CALENDAR_ENTRETIEN_ID`: Google Calendar ID for maintenance
   - `GOOGLE_CALENDAR_RENTAL_ID`: Google Calendar ID for rentals
   - `BUCKET_IMAGE_MACHINES`: Image bucket name
   - `EMAILS_REMINDER_MAINTENANCE`: Emails for maintenance reminders
   - `RENTAL_MANAGEMENT_FRONTEND_URL`: URL for rental management frontend
   - `OAUTH_REDIRECT_URI`: OAuth redirect URI

   **File Contents:**

   - `ENV_FILE`: The entire contents of your `.env` file (escaped properly)
   - `KEY_FILE`: Contents of your Google API key file (JSON format)
   - `OAUTH_CLIENT_SECRET_FILE`: Contents of your OAuth client secret file (JSON format)
   - `OAUTH_CLIENT_TOKEN_FILE`: Contents of your OAuth token file (JSON format)

2. **Database Migration**

   Before deploying, you can migrate data from Supabase to PostgreSQL using the provided script:

   ```bash
   # Create the scripts directory if it doesn't exist
   mkdir -p scripts

   # Run the migration script
   node scripts/migrate-from-supabase.js
   ```

### Local Development

1. **Set up environment variables**

   Copy `.env.template` to `.env` and configure the required variables.

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Generate Prisma client**

   ```bash
   npm run generate-prisma
   ```

4. **Start development server**

   ```bash
   npm run dev
   ```

### Deployment

Deployment is handled automatically via GitHub Actions. When you push to the `main` branch, GitHub Actions will:

1. Copy files to your VPS
2. Set up environment files and secrets from GitHub Secrets
3. Build and deploy the Docker containers

If you need to deploy manually:

1. SSH into your VPS
2. Navigate to the project directory
3. Run:
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

### Remote Monitoring with Portainer

The deployment includes Portainer, a web-based Docker management UI that allows you to:

- Monitor container logs
- View container stats (CPU, memory usage)
- Restart containers as needed
- Manage Docker volumes and networks

#### Accessing Portainer Securely

For security reasons, Portainer is not exposed directly to the internet. To access it:

1. **Use the provided SSH tunnel script:**

   ```bash
   # On your local machine
   ./scripts/portainer-tunnel.sh -u your_ssh_user -h your_vps_hostname
   ```

   This will create a secure SSH tunnel mapping the remote Portainer instance to your local machine.

2. **Access Portainer through your browser:**

   Once the tunnel is established, open http://localhost:9000 in your browser.

3. **First-time setup:**

   When accessing Portainer for the first time:

   - Create an admin account with a strong password
   - Select "Docker" as the environment type
   - Use the local socket with path: `/var/run/docker.sock`

4. **Security best practices:**
   - Always use strong passwords for the Portainer admin account
   - Close the SSH tunnel when not in use
   - Never expose Portainer directly to the internet

### Database Management

The PostgreSQL database is containerized and data is persisted via Docker volumes.

- Database data is stored in the `postgres_data` volume.
- On container startup, database migrations are run automatically.
- Database views are dropped and recreated on each server startup.

### Networking

- Only the API port (3001) is exposed to the internet.
- The PostgreSQL database is only accessible within the Docker network.
- All services communicate over the internal `app_network` Docker network.

### Maintenance

To update the server:

1. Push changes to the `main` branch and let GitHub Actions deploy
2. Or SSH into your server and run:
   ```bash
   cd /path/to/project
   git pull
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

To view logs:

```bash
docker-compose logs -f server
```

To access the database:

```bash
docker-compose exec db psql -U forestaruser -d forestardb
```
