FROM node:20 AS builder

WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy prisma schema for client generation
COPY prisma ./prisma/

# Generate Prisma client
RUN npm run generate-prisma

# Copy the rest of the code
COPY . .

# Rebuild bcrypt for this environment
RUN npm rebuild bcrypt --build-from-source

# Build the application with increased memory limit
ENV NODE_OPTIONS="--max-old-space-size=1536"
RUN npm run build

# Production stage
FROM node:20

WORKDIR /app

# Install PostgreSQL client without unnecessary packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy production node_modules
COPY --from=builder /app/node_modules /app/node_modules

# Copy built application
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/prisma /app/prisma

# Copy only necessary files
COPY package*.json ./
COPY .docker /app/.docker
COPY .env* ./
ENV NODE_OPTIONS="--max-old-space-size=1536"

# Make entrypoint executable
RUN chmod +x /app/.docker/docker-entrypoint.sh

# Set production environment
ENV NODE_ENV=production

# Expose the port
EXPOSE 3001

# Set the entry point
ENTRYPOINT ["/app/.docker/docker-entrypoint.sh"] 