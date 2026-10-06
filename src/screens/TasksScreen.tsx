import { Screen } from "../design/slots";
import { Button } from "../design/primitives";
import { TaskList, useTasks } from "../features/tasks";

/**
 * Tasks screen (M5): download/preparation tasks with live progress,
 * 3s polling while anything is active, and cancel.
 */
export function TasksScreen() {
  const {
    tasks,
    status,
    error,
    refresh,
    cancel,
    cancelingId,
    cancelError,
  } = useTasks();

  return (
    <Screen title="Задачи">
      <p className="lede">Загрузки и подготовка файлов.</p>
      <div>
        <Button variant="ghost" size="sm" onClick={refresh}>
          Обновить
        </Button>
      </div>
      <TaskList
        tasks={tasks}
        loading={status === "loading"}
        error={status === "error" ? error : null}
        onRetry={refresh}
        onCancel={(id) => {
          void cancel(id);
        }}
        cancelingId={cancelingId}
        cancelError={cancelError}
      />
    </Screen>
  );
}
