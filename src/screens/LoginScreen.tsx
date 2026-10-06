import { EmptySlot, ErrorSlot, LoadingSlot, Screen } from "../design/slots";
import { useAuth } from "../features/auth";

/**
 * Auth gate (M2). The flow is web-based: the client opens the site in the
 * system browser, the site redirects to `seans://auth/callback`.
 * There is intentionally no password form here.
 */
export function LoginScreen() {
  const { status, user, login, logout, loginPending, loginError, cancelLogin } =
    useAuth();

  if (status === "authenticated" && user) {
    return (
      <Screen title="Аккаунт">
        <div className="panel">
          <p className="lede">Вы вошли как {user.display_name || user.email}.</p>
          <a className="btn" href="#/">
            На главную
          </a>
          <button type="button" className="btn" onClick={() => void logout()}>
            Выйти
          </button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen title="Вход">
      <p className="lede">
        Вход выполняется через веб-сайт Seans. Пароль в приложении не вводится.
      </p>
      <div className="panel">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void login()}
          disabled={loginPending}
        >
          Продолжить в браузере
        </button>
        {loginPending ? (
          <button type="button" className="btn" onClick={cancelLogin}>
            Отмена
          </button>
        ) : null}
      </div>
      {loginPending ? <LoadingSlot label="Ожидание авторизации…" /> : null}
      {loginError ? (
        <ErrorSlot
          title="Не удалось завершить вход"
          description={loginError}
          onRetry={() => void login()}
        />
      ) : null}
      {!loginPending && !loginError ? (
        <EmptySlot
          title="Сессия не найдена"
          description="После входа на сайте вы вернётесь в приложение автоматически."
        />
      ) : null}
    </Screen>
  );
}
