FROM node:22.11.0-slim

# Install corepack + pnpm
RUN npm i -g corepack@latest && corepack enable

WORKDIR /app

# Copy package files first (better caching)
COPY package.json pnpm-lock.yaml .npmrc .yarnrc.yml ./

# Install dependencies
RUN corepack prepare --activate && pnpm install --frozen-lockfile

# Copy all source code
COPY . .

# Build medusa (backend + admin dashboard)
# Dummy env vars needed for config to load during build (not used for actual connections)
RUN DATABASE_URL=postgres://dummy:dummy@localhost/dummy \
    JWT_SECRET=build-placeholder \
    COOKIE_SECRET=build-placeholder \
    npx medusa build

ENV PORT=9000
EXPOSE 9000

# Start server directly (migration via Railway Pre-deploy Command)
CMD ["npx", "medusa", "start"]
