ARG NODE_VERSION=22

# Étape 1 : build Angular
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Étape 2 : nginx sert les fichiers statiques
FROM nginx:1.27-alpine
# AJOUT : Phase 14 - fix CVE-2026-31789 (openssl libcrypto3/libssl3 3.3.3-r0 -> 3.3.7-r0)
RUN apk upgrade --no-cache libcrypto3 libssl3
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
