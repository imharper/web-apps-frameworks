FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_URL=http://localhost:4000/api
ARG REDUX_REMOTE_URL=http://localhost:8083
ARG MOBX_REMOTE_URL=http://localhost:8084
ENV VITE_API_URL=${VITE_API_URL}
ENV REDUX_REMOTE_URL=${REDUX_REMOTE_URL}
ENV MOBX_REMOTE_URL=${MOBX_REMOTE_URL}

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/package.json
COPY frontend-host/package.json frontend-host/package.json
COPY frontend/package.json frontend/package.json
COPY frontend-mobx/package.json frontend-mobx/package.json
COPY services/api-gateway/package.json services/api-gateway/package.json
COPY services/user-service/package.json services/user-service/package.json
COPY services/event-service/package.json services/event-service/package.json
COPY services/booking-service/package.json services/booking-service/package.json

RUN npm ci --workspace shared --workspace frontend-host

COPY shared shared
COPY frontend-host frontend-host

RUN npm run build --workspace shared && npm run build --workspace frontend-host

FROM nginx:1.27-alpine AS runtime

COPY frontend-host/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend-host/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
