FROM alpine:latest

# Installing dependencies
RUN apk add --no-cache \
    bash \
    tar \
    gzip \
    curl \
    postgresql-client \
    tzdata \
    ca-certificates \
    wget \
    python3 \
    py3-pip

# Install rclone for Google Drive transfers
RUN curl -O https://downloads.rclone.org/rclone-current-linux-amd64.zip && \
    unzip rclone-current-linux-amd64.zip && \
    cd rclone-*-linux-amd64 && \
    cp rclone /usr/bin/ && \
    chmod 755 /usr/bin/rclone && \
    cd .. && \
    rm -rf rclone-*-linux-amd64*

# Create rclone config directory
RUN mkdir -p /root/.config/rclone

# Create scripts directory
RUN mkdir -p /app/scripts

# Copy scripts
COPY scripts/backup.sh /app/scripts/backup.sh
COPY scripts/rclone_setup.sh /app/scripts/rclone_setup.sh
COPY scripts/scheduler.sh /app/scripts/scheduler.sh

# Make scripts executable
RUN chmod +x /app/scripts/*.sh

# Create backup folders
RUN mkdir -p /backup

# Entry point
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"] 