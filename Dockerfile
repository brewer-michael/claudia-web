# Claudia (Gooey) - Web-based Claude AI interface
# GUI for interacting with Claude AI in containerized environments

FROM node:18-alpine AS builder

# Build-time metadata
LABEL stage=builder

# Install build dependencies
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    curl

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --silent

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production image
FROM node:18-alpine

# Metadata labels for Docker Hub
LABEL maintainer="brewermichael" \
    org.label-schema.name="claudia" \
    org.label-schema.description="Claudia (Gooey) - GUI for interacting with Claude AI" \
    org.label-schema.version="1.0.0" \
    org.label-schema.schema-version="1.0" \
    org.label-schema.url="https://github.com/brewer-michael/claudia-web" \
    org.label-schema.usage="https://github.com/brewer-michael/claudia-web/blob/main/README.md" \
    org.label-schema.vcs-url="https://github.com/brewer-michael/claudia-web.git" \
    org.label-schema.vendor="brewer-michael" \
    org.label-schema.docker.cmd="docker run -d -p 3000:3000 -v /path/to/workspace:/workspace -e ANTHROPIC_API_KEY=your_key brewermichael/claudia-code"

# Install runtime dependencies
RUN apk add --no-cache \
    bash \
    curl \
    git \
    openssh-client \
    nano \
    vim \
    tree \
    htop \
    sudo

# Create user and group
RUN addgroup -S claudia \
    && adduser -S -G claudia -s /bin/bash claudia \
    && echo "claudia ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/claudia

# Set working directory
WORKDIR /app

# Copy built application and server files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./

# Create a minimal package.json with only runtime dependencies
RUN echo '{\
  "name": "claudia-server",\
  "version": "1.0.0",\
  "type": "module",\
  "main": "server.js",\
  "scripts": {\
    "start": "node server.js"\
  },\
  "dependencies": {\
    "express": "^4.21.2",\
    "cors": "^2.8.5"\
  }\
}' > package.json

# Install only the runtime dependencies
RUN npm install --silent

# Create required directories
RUN mkdir -p /workspace /config /repos \
    && chown -R claudia:claudia /workspace /config /repos /app

# Environment variables matching Unraid template
ENV NODE_ENV=production \
    DEFAULT_WORKSPACE=/workspace \
    LOG_LEVEL=info \
    PUID=1000 \
    PGID=1000 \
    UMASK=022

# Switch to claudia user
USER claudia

# Expose port (matching Unraid template)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Volume declarations
VOLUME ["/workspace", "/config", "/repos"]

# Start command - run Node.js server on port 3000
CMD ["node", "server.js"]