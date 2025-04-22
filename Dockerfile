# Build UI stage
FROM node:18-alpine AS ui-builder

WORKDIR /app

# Copy package manifests first from host's ui/src
COPY ui/src/package.json ui/src/package-lock.json* ./

# Install dependencies
RUN npm install

# Create the target directories for source and public files within the container
RUN mkdir src public

# Copy contents of host's ui/public into container's /app/public
COPY ui/public/ ./public/

# Copy *specific* source files and directories from host's ui/src into container's /app/src
COPY ui/src/styles ./src/styles
COPY ui/src/components ./src/styles
COPY ui/src/contexts ./src/contexts
COPY ui/src/services ./src/services
COPY ui/src/App.js ./src/App.js
COPY ui/src/index.js ./src/index.js


# Verify structure
RUN echo "--- Contents of /app/public ---"
RUN ls -la public
RUN echo "--- Contents of /app/src ---"
RUN ls -la src

# Build the UI (runs in /app, expects ./src, ./public relative to package.json)
RUN npm run build

# Verify build output
RUN echo "--- Contents of build ---"
RUN ls -la build/


# Build Go stage
FROM golang:1.19-alpine AS go-builder

# Install build dependencies for Go
RUN apk add --no-cache gcc musl-dev

WORKDIR /app

# Copy go.mod and go.sum files
COPY go.mod go.sum ./

# Download Go dependencies
RUN go mod download

# Copy the Go source code
COPY . .

# Build the Go application
RUN CGO_ENABLED=1 GOOS=linux go build -o middleware-manager .

# Final stage
FROM alpine:3.16

RUN apk add --no-cache ca-certificates sqlite curl tzdata

WORKDIR /app

# Copy the binary from the builder stage
COPY --from=go-builder /app/middleware-manager /app/middleware-manager

# Copy UI build files from UI builder stage
# The build output is in /app/build in the ui-builder stage
COPY --from=ui-builder /app/build /app/ui/build

# Copy configuration files
COPY --from=go-builder /app/config/templates.yaml /app/config/templates.yaml

# Copy database migrations file
COPY --from=go-builder /app/database/migrations.sql /app/database/migrations.sql
# Also copy to root as fallback
COPY --from=go-builder /app/database/migrations.sql /app/migrations.sql

# Create directories for data
RUN mkdir -p /data /conf

# Set environment variables
ENV PANGOLIN_API_URL=http://pangolin:3001/api/v1 \
    TRAEFIK_CONF_DIR=/conf \
    DB_PATH=/data/middleware.db \
    PORT=3456

# Expose the port
EXPOSE 3456

# Run the application
CMD ["/app/middleware-manager"]
