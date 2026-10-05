import { EmptySlot, ErrorSlot, LoadingSlot, Screen } from "../design/slots";

/**
 * Auth gate placeholder (M1). The real flow is web-based:
 * the client opens the site, the site redirects to `seans://auth/callback`.
 * There is intentionally no password form here.
 */
export function LoginScreen() {
  return (
    <Screen title="Вход">
      <p className="lede">
        Вход выполняется через веб-сайт Seans. Пароль в приложении не вводится.
      </p>
      <div className="panel">
        <button type="button" className="btn btn-primary" disabled>
          Войти через сайт
        </button>
        <p className="hint">
          Кнопка станет активной после подключения веб-авторизации (M2).
        </p>
      </div>
      <LoadingSlot label="Ожидание авторизации…" />
      <EmptySlot
        title="Сессия не найдена"
        description="После входа на сайте вы вернётесь в приложение автоматически."
      />
      <ErrorSlot
        title="Не удалось завершить вход"
        description="Ссылка авторизации устарела или повреждена. Попробуйте ещё раз."
      />
    </Screen>
  );
}
