import { EmptySlot, ErrorSlot, LoadingSlot, Screen } from "../design/slots";
import { ROOM_CODE_PATTERN } from "../lib/deepLink";

/** Room placeholder (M1). Real room playback arrives with rooms (M10). */
export function RoomScreen({ code }: { code: string }) {
  const valid = ROOM_CODE_PATTERN.test(code);

  if (!valid) {
    return (
      <Screen title="Комната">
        <ErrorSlot
          title="Неверный код комнаты"
          description="Код должен состоять из 8 символов (A–Z, 2–9)."
        />
      </Screen>
    );
  }

  return (
    <Screen title={`Комната ${code}`}>
      <p className="lede">Совместный просмотр. Код комнаты: {code}</p>
      <LoadingSlot label="Подключение к комнате…" />
      <EmptySlot
        title="В комнате пока никого нет"
        description="Участники появятся здесь, когда подключатся."
      />
      <ErrorSlot
        title="Не удалось подключиться к комнате"
        description="Комната недоступна. Проверьте код и попробуйте снова."
      />
    </Screen>
  );
}
