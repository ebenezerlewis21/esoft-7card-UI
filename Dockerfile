# Dockerfile to run the Expo dev server (npm run start:dev)
# Expo SDK 54 — see https://docs.expo.dev/versions/v54.0.0/
FROM node:20-bookworm-slim

# Expo CLI works best with a non-root user, but for a dev container we keep
# things simple and run as root so installed deps/cache are writable.
WORKDIR /app

# Install dependencies first to leverage Docker layer caching.
# Copy only the manifests so this layer is reused unless deps change.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source.
COPY . .

# start:dev runs `expo start --port 8082`.
# 8082  -> Metro bundler / dev server (this app's configured port)
# 19000 -> Expo dev server (legacy)
# 19001 -> Expo dev server websocket
# 19006 -> Expo web
EXPOSE 8082 19000 19001 19006

# Bind Metro to all interfaces and disable the interactive TUI so it runs
# cleanly inside a container. Tunnel/LAN reachability still depends on how
# you run the container (see notes below in README/usage).
ENV EXPO_NO_TELEMETRY=1 \
    CI=1

# `expo-dev-client` is a dependency, so `expo start` would default to the
# dev-client. Force Expo Go with `--go` by calling the CLI directly instead of
# the start:dev script (which has no --go flag), keeping NODE_ENV + port 8082.
CMD ["npx", "cross-env", "NODE_ENV=development", "expo", "start", "--go", "--port", "8082"]
