/**
 * Task list display + cancel (M5). Russian UI strings.
 */

import type { ApiId, TaskDetailResponse } from "../../api/types";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  ProgressBar,
  Spinner,
} from "../../design/primitives";
import { formatBytes, formatSpeed } from "../../lib/format";
import { formatTaskStatus, isTaskActive } from "./taskHelpers";

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TaskItem({
  task,
  canceling,
  cancelError,
  onCancel,
}: {
  task: TaskDetailResponse;
  canceling: boolean;
  cancelError?: string | null;
  onCancel?: (taskId: ApiId) => void;
}) {
  const active = isTaskActive(task.status);
  return (
    <article className="task-item">
      <header className="task-item-header">
        <Badge tone={active ? "accent" : task.error ? "danger" : "neutral"}>
          {formatTaskStatus(task.status)}
        </Badge>
        {task.stage ? <span className="task-stage">{task.stage}</span> : null}
        <time className="task-date" dateTime={task.created_at}>
          {formatDateTime(task.created_at)}
        </time>
      </header>

      <ProgressBar
        value={task.progress_pct}
        max={100}
        label={`${Math.round(task.progress_pct)}% · ${formatBytes(task.reserved_bytes)}`}
      />

      <div className="task-item-meta">
        <span>Скорость: {formatSpeed(task.speed_bps)}</span>
      </div>

      {task.error ? (
        <p className="task-error" role="alert">
          {task.error}
        </p>
      ) : null}
      {cancelError ? (
        <p className="task-error" role="alert">
          {cancelError}
        </p>
      ) : null}

      {active && onCancel ? (
        <div className="task-item-actions">
          <Button
            variant="danger"
            size="sm"
            disabled={canceling}
            onClick={() => onCancel(task.id)}
          >
            {canceling ? "Отмена…" : "Отменить"}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

export function TaskList({
  tasks,
  loading,
  error,
  onRetry,
  onCancel,
  cancelingId,
  cancelError,
}: {
  tasks: TaskDetailResponse[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  onCancel?: (taskId: ApiId) => void;
  cancelingId?: ApiId | null;
  cancelError?: string | null;
}) {
  if (loading) {
    return <Spinner label="Загрузка задач…" />;
  }
  if (error) {
    return (
      <ErrorState
        title="Не удалось загрузить задачи"
        description={error}
        onRetry={onRetry}
      />
    );
  }
  if (tasks.length === 0) {
    return (
      <EmptyState
        title="Нет задач"
        description="Создайте задачу загрузки на странице фильма."
      />
    );
  }

  return (
    <div className="task-list">
      {tasks.map((task) => (
        <TaskItem
          key={String(task.id)}
          task={task}
          canceling={cancelingId != null && String(cancelingId) === String(task.id)}
          cancelError={
            cancelingId != null && String(cancelingId) === String(task.id)
              ? cancelError
              : null
          }
          onCancel={onCancel}
        />
      ))}
    </div>
  );
}
