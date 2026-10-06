import { Button } from "../design/primitives";
import { Screen } from "../design/slots";
import { themeLabel } from "../design/theme";
import { useThemePreference } from "../design/useTheme";
import { UpdateSettingsSection } from "../features/updater";

/** Settings (M3 theme + M11 updates/version). Subtitle prefs arrive later. */
export function SettingsScreen() {
  const { preference, cycle } = useThemePreference();

  return (
    <Screen title="Настройки">
      <p className="lede">Оформление, обновления и параметры приложения.</p>
      <div className="panel">
        <strong>Тема оформления</strong>
        <p className="hint">Текущая тема: {themeLabel(preference)}.</p>
        <Button variant="secondary" onClick={cycle}>
          Сменить тему
        </Button>
      </div>
      <UpdateSettingsSection />
      <div className="panel">
        <strong>Воспроизведение</strong>
        <p className="hint">
          Аппаратное декодирование: авто (d3d11 / dxva2), программный резервный
          режим включается автоматически при сбое.
        </p>
        <p className="hint">Субтитры: настройки появятся в следующих версиях.</p>
      </div>
    </Screen>
  );
}
