FROM node:lts-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

ARG ENVIRONMENT
ENV ENVIRONMENT=$ENVIRONMENT
ARG FRONTEND_PORT
ENV FRONTEND_PORT=$FRONTEND_PORT
ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_SOURCE
ENV NEXT_PUBLIC_SOURCE=$NEXT_PUBLIC_SOURCE
ARG NEXT_PUBLIC_SMTP_ENABLED
ENV NEXT_PUBLIC_SMTP_ENABLED=$NEXT_PUBLIC_SMTP_ENABLED

WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH

# Copy workspace config, lockfile, and frontend package.json
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/frontend/package.json ./apps/frontend/

# Install dependencies (frozen lockfile for reproducible builds)
WORKDIR /app/apps/frontend
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

# Copy frontend source (node_modules excluded via .dockerignore)
COPY apps/frontend/ ./

# Only build in production mode
RUN if [ "$ENVIRONMENT" = "production" ]; then pnpm run build; fi

# Start script: dev mode for development, production server otherwise
CMD if [ "$ENVIRONMENT" = "development" ]; then pnpm run dev; else pnpm run start; fi
