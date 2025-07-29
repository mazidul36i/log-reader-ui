# Docker/Podman Setup for Log Reader React

This document provides instructions for running the Log Reader React application using Docker or Podman.

## Prerequisites

- Docker installed on your system, OR
- Podman installed on your system
- Docker Compose or Podman Compose (optional, but recommended)

## Building and Running with Podman

### Option 1: Using Podman Compose (Recommended)

1. Build and start the container:
```bash
podman compose up --build
```

2. Access the application at: http://localhost:3000

3. To run in detached mode:
```bash
podman compose up -d --build
```

4. To stop the container:
```bash
podman compose down
```

### Option 2: Using Podman Commands Directly

1. Build the Podman image:
```bash
podman build -t log-reader-react .
```

2. Run the container:
```bash
podman run -p 3000:80 --name log-reader-react-app log-reader-react
```

3. Access the application at: http://localhost:3000

4. To stop the container:
```bash
podman stop log-reader-react-app
podman rm log-reader-react-app
```

## Building and Running with Docker

### Option 1: Using Docker Compose (Recommended)

1. Build and start the container:
```bash
docker-compose up --build
```

2. Access the application at: http://localhost:3000

3. To run in detached mode:
```bash
docker-compose up -d --build
```

4. To stop the container:
```bash
docker-compose down
```

### Option 2: Using Docker Commands Directly

1. Build the Docker image:
```bash
docker build -t log-reader-react .
```

2. Run the container:
```bash
docker run -p 3000:80 --name log-reader-react-app log-reader-react
```

3. Access the application at: http://localhost:3000

4. To stop the container:
```bash
docker stop log-reader-react-app
docker rm log-reader-react-app
```

## Docker Image Details

- **Base Images**: 
  - Build stage: `node:18-alpine`
  - Production stage: `nginx:alpine`
- **Port**: The application runs on port 80 inside the container, mapped to port 3000 on the host
- **Build Process**: Multi-stage build that creates an optimized production bundle served by Nginx

## Customization

### Custom Nginx Configuration

If you need to customize the Nginx configuration, uncomment the line in the Dockerfile:
```dockerfile
COPY nginx.conf /etc/nginx/nginx.conf
```

Then create a `nginx.conf` file in the project root with your custom configuration.

### Environment Variables

To pass environment variables to the React build process, you can modify the Dockerfile to include them during the build stage:

```dockerfile
# Add before the build command
ENV REACT_APP_API_URL=your_api_url_here
```

## Troubleshooting

1. **Build fails**: Ensure all dependencies are properly listed in package.json
2. **Port conflicts**: Change the host port in docker-compose.yml if port 3000 is already in use
3. **Permission issues**: Make sure Docker has proper permissions on your system

## Development vs Production

This Docker setup is optimized for production deployment. For development, you might want to:
- Use volume mounts for live code reloading
- Run the development server instead of building for production
- Use a different Dockerfile for development purposes
