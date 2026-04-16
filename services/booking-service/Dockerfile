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

RUN npm ci --workspace shared --workspace services/booking-service

COPY shared shared
COPY services/booking-service services/booking-service

RUN npm run build --workspace shared && npm run build --workspace services/booking-service

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

RUN npm ci --omit=dev --workspace shared --workspace services/booking-service

COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/services/booking-service/dist services/booking-service/dist

EXPOSE 4003

CMD ["node", "services/booking-service/dist/index.js"]
