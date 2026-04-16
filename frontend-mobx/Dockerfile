FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_URL=http://localhost:4000/api
ENV VITE_API_URL=${VITE_API_URL}

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/package.json
COPY frontend-host/package.json frontend-host/package.json
COPY frontend/package.json frontend/package.json
COPY frontend-mobx/package.json frontend-mobx/package.json
COPY services/api-gateway/package.json services/api-gateway/package.json
COPY services/user-service/package.json services/user-service/package.json
COPY services/event-service/package.json services/event-service/package.json
COPY services/booking-service/package.json services/booking-service/package.json

RUN npm ci --workspace shared --workspace frontend-mobx

COPY shared shared
COPY frontend frontend
COPY frontend-mobx frontend-mobx

RUN npm run build --workspace shared && npm run build --workspace frontend-mobx

FROM nginx:1.27-alpine AS runtime

COPY frontend-mobx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend-mobx/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
