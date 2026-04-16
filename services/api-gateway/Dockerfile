FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/package.json
COPY frontend-host/package.json frontend-host/package.json
COPY frontend/package.json frontend/package.json
COPY frontend-mobx/package.json frontend-mobx/package.json
COPY services/api-gateway/package.json services/api-gateway/package.json
COPY services/user-service/package.json services/user-service/package.json
COPY services/event-service/package.json services/event-service/package.json
COPY services/booking-service/package.json services/booking-service/package.json

RUN npm ci --workspace shared --workspace services/api-gateway

COPY shared shared
COPY services/api-gateway services/api-gateway

RUN npm run build --workspace shared && npm run build --workspace services/api-gateway

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY frontend-host/package.json frontend-host/package.json
COPY frontend/package.json frontend/package.json
COPY frontend-mobx/package.json frontend-mobx/package.json
COPY services/api-gateway/package.json services/api-gateway/package.json
COPY services/user-service/package.json services/user-service/package.json
COPY services/event-service/package.json services/event-service/package.json
COPY services/booking-service/package.json services/booking-service/package.json

RUN npm ci --omit=dev --workspace shared --workspace services/api-gateway

COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/services/api-gateway/dist services/api-gateway/dist

EXPOSE 4000

CMD ["node", "services/api-gateway/dist/index.js"]
