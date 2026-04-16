import { Suspense, lazy, useEffect, useState } from "react";
import type { User, UserRole } from "@shared";
import NotificationIsland from "./NotificationIsland";
import { shellApi } from "./api";

const TOKEN_STORAGE_KEY = "ticket_cabinet_token";

const ReduxRemote = lazy(() => import("reduxApp/RemoteDashboard"));
const MobxRemote = lazy(() => import("mobxApp/RemoteDashboard"));

type AuthMode = "login" | "register";
type ActiveApp = "redux" | "mobx";

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [activeApp, setActiveApp] = useState<ActiveApp>("redux");
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(Boolean(token));
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "user" as UserRole,
  });

  useEffect(() => {
    async function bootstrap() {
      if (!token) {
        setCurrentUser(null);
        setBootstrapping(false);
        return;
      }

      try {
        const user = await shellApi.me(token);
        setCurrentUser(user);
      } catch (e) {
        clearSession();
        setError(e instanceof Error ? e.message : "Не удалось восстановить сессию");
      } finally {
        setBootstrapping(false);
      }
    }

    void bootstrap();
  }, [token]);

  function clearSession() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setCurrentUser(null);
  }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    try {
      const response =
        authMode === "login"
          ? await shellApi.login({
              email: authForm.email,
              password: authForm.password,
            })
          : await shellApi.register({
              email: authForm.email,
              password: authForm.password,
              name: authForm.name,
              role: authForm.role,
            });

      localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
      setToken(response.token);
      setCurrentUser(response.user);
      setInfo(authMode === "login" ? "Вход выполнен" : "Регистрация выполнена");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка аутентификации");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearSession();
    setInfo("Вы вышли из системы");
  }

  if (bootstrapping) {
    return (
      <main className="auth-layout">
        <section className="shell-card auth-card">
          <p>Восстанавливаю сессию...</p>
        </section>
      </main>
    );
  }

  if (!token || !currentUser) {
    return (
      <main className="auth-layout">
        <NotificationIsland error={error} info={info} onClearError={() => setError("")} onClearInfo={() => setInfo("")} />
        <section className="shell-card auth-card">
          <div className="hero-copy">
            <h1>Ticket Cabinet Host</h1>
            <p>Host-приложение управляет авторизацией, шапкой, footer и переключением между Redux и MobX microfrontend-приложениями.</p>
          </div>

          <div className="nav-tabs">
            <button type="button" className={`nav-tab ${authMode === "login" ? "active" : ""}`} onClick={() => setAuthMode("login")}>
              Вход
            </button>
            <button type="button" className={`nav-tab ${authMode === "register" ? "active" : ""}`} onClick={() => setAuthMode("register")}>
              Регистрация
            </button>
          </div>

          <form className="auth-form" onSubmit={submitAuth}>
            {authMode === "register" && (
              <>
                <input
                  placeholder="Имя"
                  value={authForm.name}
                  onChange={(e) => setAuthForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
                <select value={authForm.role} onChange={(e) => setAuthForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}>
                  <option value="user">Пользователь</option>
                  <option value="admin">Администратор</option>
                </select>
              </>
            )}

            <input
              type="email"
              placeholder="Email"
              value={authForm.email}
              onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
            <input
              type="password"
              placeholder="Пароль"
              value={authForm.password}
              onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
            <button type="submit" className="auth-submit" disabled={loading}>
              {authMode === "login" ? "Войти" : "Создать аккаунт"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  const ActiveRemote = activeApp === "redux" ? ReduxRemote : MobxRemote;

  return (
    <div className="shell">
      <NotificationIsland error={error} info={info} onClearError={() => setError("")} onClearInfo={() => setInfo("")} />

      <header className="shell-header">
        <div>
          <h1>Ticket Cabinet Host</h1>
          <p>
            {currentUser.name} ({currentUser.email}) • роль: <strong>{currentUser.role}</strong>
          </p>
        </div>

        <div className="header-actions">
          <nav className="nav-tabs">
            <button type="button" className={`nav-tab ${activeApp === "redux" ? "active" : ""}`} onClick={() => setActiveApp("redux")}>
              Redux MF
            </button>
            <button type="button" className={`nav-tab ${activeApp === "mobx" ? "active" : ""}`} onClick={() => setActiveApp("mobx")}>
              MobX MF
            </button>
          </nav>

          <button type="button" className="shell-button" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>

      <main className="shell-main">
        <section className="shell-card remote-stage">
          <Suspense fallback={<div className="loading-state">Загрузка microfrontend...</div>}>
            <ActiveRemote
              token={token}
              currentUser={currentUser}
              onLogout={() => {
                logout();
                setError("Сессия завершена в microfrontend-приложении");
              }}
            />
          </Suspense>
        </section>
      </main>

      <footer className="shell-footer">
        <p>Host управляет авторизацией, shell-структурой и навигацией между microfrontend-приложениями.</p>
        <p>Лабораторная работа №4</p>
      </footer>
    </div>
  );
}
