# Ticket Cabinet

Монорепозиторий системы бронирования билетов с backend-микросервисами, host-приложением и двумя microfrontend-приложениями.

## Состав монорепозитория

- `shared` — общий пакет типов и переиспользуемых webpack-конфигов
- `frontend-host` — host-приложение на React + webpack + Module Federation
- `frontend` — Redux Toolkit / RTK Query microfrontend
- `frontend-mobx` — MobX microfrontend
- `services/api-gateway` — gateway API
- `services/user-service` — регистрация, логин, профиль, роли пользователей
- `services/event-service` — мероприятия и свободные места
- `services/booking-service` — бронирования и отмена бронирований

## Microfrontend-архитектура

- Host отвечает за окно авторизации, header, footer, переключение между microfrontend-приложениями и выход из системы.
- `frontend` подключается как remote `reduxApp`.
- `frontend-mobx` подключается как remote `mobxApp`.
- Сборка всех frontend-приложений настроена через webpack.
- Module Federation и базовые webpack-настройки вынесены в `shared/webpack/createConfig.js`.

## State Management

### Redux remote

- Данные backend (`currentUser`, `events`, `bookings`) управляются через Redux store.
- Сетевые запросы реализованы через RTK Query.
- Кэширование реализовано средствами RTK Query.

### MobX remote

- Данные backend (`currentUser`, `events`, `bookings`) управляются через MobX store.
- Запросы централизованы в store.
- Кэширование реализовано через TTL-кэш.

В обоих remote-frontend-приложениях одни и те же данные используются в нескольких частях интерфейса: например, `events` и `bookings` участвуют и в блоке профиля, и в основных списках.

## Локальный запуск

1. Установить зависимости:

```bash
npm install
```

2. Создать `.env` на основе `.env.example`.

3. Запустить backend-сервисы:

```bash
npm run dev:users
npm run dev:events
npm run dev:bookings
npm run dev:gateway
```

4. Запустить frontend-часть:

```bash
npm run dev:frontend
```

```bash
npm run dev:frontend:redux
```

```bash
npm run dev:frontend:mobx
```

По умолчанию:

- host: `http://localhost:3000`
- Redux remote: `http://localhost:3001`
- MobX remote: `http://localhost:3002`
- gateway API: `http://localhost:4000`
- swagger-ui: `http://localhost:8081`

## Docker

Запуск полного стека:

```bash
docker compose up --build
```

После запуска доступны:

- host: `http://localhost:8080`
- Redux remote: `http://localhost:8083`
- MobX remote: `http://localhost:8084`
- gateway API: `http://localhost:4000`
- swagger-ui: `http://localhost:8081`
- postgres: `localhost:5433`

## Swagger

OpenAPI-контракт расположен в файле:

- `docs/openapi.yaml`
