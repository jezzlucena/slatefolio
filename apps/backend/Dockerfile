FROM node:lts-alpine

# Install build dependencies for native modules (bcrypt, etc.)
RUN apk add --no-cache python3 make g++

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH

# Copy workspace config, lockfile, and backend package.json
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/

# Install dependencies (frozen lockfile for reproducible builds)
WORKDIR /app/apps/backend
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

# Copy backend source (node_modules excluded via .dockerignore)
COPY apps/backend/ ./

CMD ["pnpm", "run", "start"]
