import { Badge, Button } from "../design/primitives";
import { Screen } from "../design/slots";
import { useAuth } from "../features/auth";
import { ROUTES } from "../lib/routeResolver";

/** Account screen (M3 placeholder over the M2 auth context). */
export function AccountScreen() {
  const { user, logout } = useAuth();

  return (
    <Screen title="Аккаунт">
      {user ? (
        <div className="panel">
          <Badge tone="accent">Вход выполнен</Badge>
          <strong>{user.display_name || user.email}</strong>
          <p className="hint">{user.email}</p>
          <div className="state-actions">
            <Button variant="secondary" onClick={() => void logout()}>
              Выйти
            </Button>
          </div>
        </div>
      ) : (
        <div className="panel">
          <Badge tone="neutral">Не выполнен</Badge>
          <p className="lede">Сессия не найдена.</p>
          <a className="btn btn-primary" href={ROUTES.login}>
            Войти
          </a>
        </div>
      )}
    </Screen>
  );
}
