FROM node:24.19.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm test && npm run build

FROM nginx:1.28.0-alpine AS runtime
ENV PAYLINK_API_UPSTREAM=http://paylink-server:4000
ENV NGINX_ENVSUBST_FILTER=^PAYLINK_API_UPSTREAM$
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/paylink-ui/browser /usr/share/nginx/html
EXPOSE 8200
CMD ["nginx", "-g", "daemon off;"]
