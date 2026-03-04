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
RUN npx medusa build

EXPOSE 9000

# Start: run migrations then start server
CMD ["sh", "-c", "npx medusa db:migrate && npx medusa start"]
