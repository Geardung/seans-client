import type { ReactNode } from "react";

/** Shared loading / empty / error slots used by every M1 screen. */
export function LoadingSlot({ label = "Загрузка…" }: { label?: string }) {
  return (
    <div className="slot slot-loading" role="status" aria-live="polite">
      <span className="slot-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptySlot({
  title = "Пусто",
  description = "Здесь пока ничего нет.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="slot slot-empty">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function ErrorSlot({
  title = "Ошибка",
  description = "Что-то пошло не так. Попробуйте ещё раз.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="slot slot-error" role="alert">
      <strong>{title}</strong>
      <p>{description}</p>
      {onRetry ? (
        <button type="button" className="btn" onClick={onRetry}>
          Повторить
        </button>
      ) : null}
    </div>
  );
}

export function Screen({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="screen">
      <header className="screen-header">
        <h1>{title}</h1>
      </header>
      <div className="screen-body">{children}</div>
    </section>
  );
}
