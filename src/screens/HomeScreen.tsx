import { Screen } from "../design/slots";
import { SearchPanel } from "../features/search";

/** Home: catalog search with debounced input and poster grid (M4). */
export function HomeScreen() {
  return (
    <Screen title="Seans">
      <p className="lede">
        Найдите фильм или сериал и откройте его страницу, чтобы посмотреть
        описание и отзывы.
      </p>
      <SearchPanel />
    </Screen>
  );
}
