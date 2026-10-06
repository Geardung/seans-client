import { EmptyState, ErrorState, Spinner } from "../design/primitives";

/**
 * Shared M3 placeholder body: loading + empty + error affordances
 * every screen must expose until real data lands in later milestones.
 */
export function ScreenStates({
  loadingLabel = "Загрузка…",
  emptyTitle = "Пока пусто",
  emptyDescription = "Данные появятся здесь после подключения к сервису.",
  errorTitle = "Не удалось загрузить",
  errorDescription = "Проверьте подключение к интернету и повторите попытку.",
}: {
  loadingLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  errorTitle?: string;
  errorDescription?: string;
}) {
  return (
    <>
      <Spinner label={loadingLabel} />
      <EmptyState title={emptyTitle} description={emptyDescription} />
      <ErrorState title={errorTitle} description={errorDescription} />
    </>
  );
}
