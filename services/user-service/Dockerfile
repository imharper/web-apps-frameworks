FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/package.json
COPY services/user-service/package.json services/user-service/package.json

RUN npm ci --workspace shared --workspace services/user-service

COPY shared shared
COPY services/user-service services/user-service

RUN npm run build --workspace shared && npm run build --workspace services/user-service

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY services/user-service/package.json services/user-service/package.json

RUN npm ci --omit=dev --workspace shared --workspace services/user-service

COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/services/user-service/dist services/user-service/dist

EXPOSE 4001

CMD ["node", "services/user-service/dist/index.js"]
