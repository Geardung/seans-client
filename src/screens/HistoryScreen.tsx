import { useEffect, useState } from "react";
import { Screen } from "../design/slots";
import { Button } from "../design/primitives";
import type { ApiId, LibraryItem } from "../api/types";
import { fetchLibrary } from "../api/endpoints";
import {
  buildFileTitleMap,
  HistoryList,
  useHistoryList,
} from "../features/history";
import { openPlayer } from "../features/player";

/**
 * History screen (M9): continue-watching list from GET /api/history.
 * Titles are resolved best-effort via the library; file id is the fallback.
 */
export function HistoryScreen() {
  const { items, status, error, refresh } = useHistoryList();
  const [titles, setTitles] = useState<Map<string, string>>(new Map());

  // Best-effort title lookup — a library failure only drops to file-id labels.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    void (async () => {
      try {
        const list: LibraryItem[] = await fetchLibrary(controller.signal);
        if (cancelled || controller.signal.aborted) return;
        setTitles(buildFileTitleMap(list));
      } catch {
        // Keep empty map (file-id fallback).
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [items.length]);

  return (
    <Screen title="История">
      <p className="lede">Недавно просмотренное.</p>
      <div>
        <Button variant="ghost" size="sm" onClick={refresh}>
          Обновить
        </Button>
      </div>
      <HistoryList
        items={items}
        loading={status === "loading"}
        error={status === "error" ? error : null}
        titles={titles}
        onRetry={refresh}
        onContinue={(fileId: ApiId, startAt: number | null) =>
          openPlayer(fileId, { startAt })
        }
      />
    </Screen>
  );
}
