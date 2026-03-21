# Ticket Cabinet

Личный кабинет системы бронирования билетов на мероприятия.

## Архитектура

- `frontend` — React + TypeScript приложение на Redux Toolkit и RTK Query
- `frontend-mobx` — React + TypeScript приложение на MobX
- `shared` — общий пакет типов
- `services/api-gateway` — входная точка API, проверка JWT, маршрутизация
- `services/user-service` — регистрация, логин, профиль, роли пользователей
- `services/event-service` — список и создание мероприятий, учет свободных мест
- `services/booking-service` — бронирования и отмена бронирований пользователя

Оба фронтенда работают с одним backend API.

## Локальный запуск

1. Установить зависимости:

```bash
npm install
```

2. Создать `.env` на основе `.env.example`.

3. Запустить backend-сервисы в отдельных терминалах:

```bash
npm run dev:users
npm run dev:events
npm run dev:bookings
npm run dev:gateway
```

4. Запустить нужный фронтенд:

```bash
npm run dev:frontend
```

```bash
npm run dev:frontend:mobx
```

По умолчанию:

- Redux RTK frontend: `http://localhost:5173`
- MobX frontend: `http://localhost:5174`
- gateway API: `http://localhost:4000`
- swagger-ui: `http://localhost:8081`
- postgres: `localhost:5433`

## State Management

### Redux RTK

- Все backend-данные (`currentUser`, `events`, `bookings`) управляются через Redux store.
- Сетевые запросы реализованы через RTK Query.
- Кэширование выполняется средствами RTK Query.
- Одни и те же `events` и `bookings` используются и в карточке профиля, и в основных списках.

### MobX

- Все backend-данные (`currentUser`, `events`, `bookings`) управляются через MobX store.
- Для запросов используется централизованный store.
- Кэширование реализовано через TTL-кэш внутри store.
- Одни и те же `events` и `bookings` используются и в карточке профиля, и в основных списках.

## Docker

Запуск всего стека:

```bash
docker compose up --build
```

После запуска доступны:

- Redux RTK frontend: `http://localhost:8080`
- MobX frontend: `http://localhost:8082`
- gateway API: `http://localhost:4000`
- swagger-ui: `http://localhost:8081`
- postgres: `localhost:5433`

## Swagger

OpenAPI-контракт находится в файле:

- `docs/openapi.yaml`
