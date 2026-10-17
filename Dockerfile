FROM node:24.19.0-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY . .

ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
