import { EmptySlot, ErrorSlot, LoadingSlot, Screen } from "../design/slots";

/** Home placeholder (M1). Catalog/search land in later milestones. */
export function HomeScreen() {
  return (
    <Screen title="Seans">
      <p className="lede">
        Домашняя страница. Поиск фильмов и каталог появятся позже.
      </p>
      <LoadingSlot label="Загрузка каталога…" />
      <EmptySlot
        title="Каталог пуст"
        description="Фильмы появятся здесь после подключения к сервису."
      />
      <ErrorSlot
        title="Не удалось загрузить каталог"
        description="Проверьте подключение к интернету и повторите попытку."
      />
    </Screen>
  );
}
