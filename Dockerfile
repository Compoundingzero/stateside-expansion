FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG PUBLIC_SITE_URL
ARG RAILWAY_PUBLIC_DOMAIN
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL
ENV RAILWAY_PUBLIC_DOMAIN=$RAILWAY_PUBLIC_DOMAIN
RUN npm run build
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY server.mjs runtime-storage.mjs package.json ./
COPY src/server ./src/server
USER node
EXPOSE 3000
CMD ["node","server.mjs"]
