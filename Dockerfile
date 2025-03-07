FROM node:20

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Install PostgreSQL client for database operations in entrypoint script
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

# Copy the rest of the code, excluding node_modules (should be defined in .dockerignore)
COPY . ./

# Make sure bcrypt is properly rebuilt for this environment
RUN npm rebuild bcrypt --build-from-source

# Generate Prisma client
RUN npm run generate-prisma

# Build the application with increased memory limit
ENV NODE_OPTIONS="--max-old-space-size=1536"

RUN npm run build

# Expose the port your app runs on
EXPOSE 3001

RUN chmod 777 /app/.docker/docker-entrypoint.sh

# Set the entry point to our script
ENTRYPOINT ["/app/.docker/docker-entrypoint.sh"] 