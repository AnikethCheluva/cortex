import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  showToast,
  Toast,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { apiGet, apiSend, prefs, TaskItem, TaskStatus } from "./shared";

const PRIO_COLOR: Record<TaskItem["priority"], Color> = {
  high: Color.Red,
  medium: Color.Yellow,
  low: Color.SecondaryText,
};
const STATUS_ICON: Record<TaskStatus, Icon> = {
  todo: Icon.Circle,
  in_progress: Icon.CircleEllipsis,
  done: Icon.CheckCircle,
};

export default function Tasks() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { base } = prefs();

  async function load() {
    setLoading(true);
    try {
      const r = await apiGet<{ tasks: TaskItem[] }>("/api/tasks");
      setTasks(r.tasks ?? []);
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Couldn't load tasks",
        message: (e as Error).message,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function setStatus(t: TaskItem, status: TaskStatus) {
    const toast = await showToast({ style: Toast.Style.Animated, title: "Updating…" });
    try {
      await apiSend("PATCH", `/api/tasks/${encodeURIComponent(t.id)}`, { status });
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status } : x)));
      toast.style = Toast.Style.Success;
      toast.title = status === "done" ? "Marked done" : `Moved to ${status.replace("_", " ")}`;
    } catch (e) {
      toast.style = Toast.Style.Failure;
      toast.title = "Update failed";
      toast.message = (e as Error).message;
    }
  }

  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  function row(t: TaskItem) {
    const accessories: List.Item.Accessory[] = [];
    if (t.due_date) accessories.push({ tag: { value: t.due_date, color: Color.Orange } });
    accessories.push({ tag: { value: t.priority, color: PRIO_COLOR[t.priority] } });
    return (
      <List.Item
        key={t.id}
        icon={{
          source: STATUS_ICON[t.status],
          tintColor: t.status === "done" ? Color.Green : undefined,
        }}
        title={t.title}
        subtitle={t.project}
        accessories={accessories}
        actions={
          <ActionPanel>
            {t.status !== "done" && (
              <Action title="Mark Done" icon={Icon.CheckCircle} onAction={() => setStatus(t, "done")} />
            )}
            {t.status === "todo" && (
              <Action
                title="Mark in Progress"
                icon={Icon.CircleEllipsis}
                onAction={() => setStatus(t, "in_progress")}
              />
            )}
            {t.status === "done" && (
              <Action title="Reopen" icon={Icon.Circle} onAction={() => setStatus(t, "todo")} />
            )}
            {base && <Action.OpenInBrowser title="Open Web App" url={base} />}
            <Action
              title="Reload"
              icon={Icon.ArrowClockwise}
              shortcut={{ modifiers: ["cmd"], key: "r" }}
              onAction={() => void load()}
            />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <List isLoading={loading} searchBarPlaceholder="Filter tasks…">
      <List.Section title="Open" subtitle={`${open.length}`}>
        {open.map(row)}
      </List.Section>
      <List.Section title="Done" subtitle={`${done.length}`}>
        {done.map(row)}
      </List.Section>
    </List>
  );
}
