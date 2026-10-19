FROM node:24.19.0-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json .nvmrc ./
COPY src ./src
RUN npm run build

FROM node:24.19.0-bookworm-slim

ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

EXPOSE 4000
USER node
CMD ["node", "dist/express-server.js"]
