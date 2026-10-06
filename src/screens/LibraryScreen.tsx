import { Screen } from "../design/slots";
import { Button } from "../design/primitives";
import { LibraryList, useLibrary } from "../features/library";

/**
 * Library screen (M6): saved media with prepared files, play and
 * create-room actions for ready files.
 */
export function LibraryScreen() {
  const { items, status, error, refresh } = useLibrary();

  return (
    <Screen title="Библиотека">
      <p className="lede">Сохранённые фильмы и сериалы.</p>
      <div>
        <Button variant="ghost" size="sm" onClick={refresh}>
          Обновить
        </Button>
      </div>
      <LibraryList
        items={items}
        loading={status === "loading"}
        error={status === "error" ? error : null}
        onRetry={refresh}
      />
    </Screen>
  );
}
