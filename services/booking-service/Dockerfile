FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/package.json
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
COPY services/booking-service/package.json services/booking-service/package.json

RUN npm ci --omit=dev --workspace shared --workspace services/booking-service

COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/services/booking-service/dist services/booking-service/dist

EXPOSE 4003

CMD ["node", "services/booking-service/dist/index.js"]
