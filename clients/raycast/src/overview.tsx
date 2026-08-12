import {
  Color,
  Icon,
  launchCommand,
  LaunchType,
  MenuBarExtra,
  open,
  openCommandPreferences,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { apiGet, Overview, prefs, TaskItem } from "./shared";

const prioColor = (p: TaskItem["priority"]) =>
  p === "high" ? Color.Red : p === "medium" ? Color.Yellow : Color.SecondaryText;

// Persistent menu-bar item: streak · open · overdue, with a dropdown of top
// tasks and quick actions. Refreshes on the command's interval (see manifest).
export default function Command() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const { base } = prefs();

  useEffect(() => {
    apiGet<Overview>("/api/overview")
      .then(setData)
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const title = data
    ? `${data.streak}d · ${data.tasks.open} open${data.tasks.overdue ? ` · ${data.tasks.overdue}!` : ""}`
    : undefined;

  return (
    <MenuBarExtra icon="icon.png" title={title} isLoading={loading} tooltip="Cortex">
      {err && (
        <MenuBarExtra.Item
          title={`Error: ${err}`}
          icon={Icon.Warning}
          onAction={openCommandPreferences}
        />
      )}
      {data && (
        <>
          <MenuBarExtra.Section title={data.today.label}>
            <MenuBarExtra.Item
              title={data.today.exists ? "Today's note started" : "No note yet today"}
              icon={data.today.exists ? Icon.CheckCircle : Icon.Circle}
              onAction={() => base && open(base)}
            />
            <MenuBarExtra.Item
              title="Jot to Today…"
              icon={Icon.Pencil}
              shortcut={{ modifiers: ["cmd"], key: "j" }}
              onAction={() => launchCommand({ name: "jot", type: LaunchType.UserInitiated })}
            />
          </MenuBarExtra.Section>

          <MenuBarExtra.Section
            title={`Tasks — ${data.tasks.open} open · ${data.tasks.done} done${
              data.tasks.overdue ? ` · ${data.tasks.overdue} overdue` : ""
            }`}
          >
            {data.tasks.top.map((t) => (
              <MenuBarExtra.Item
                key={t.id}
                title={t.title}
                subtitle={t.project}
                icon={{ source: Icon.Dot, tintColor: prioColor(t.priority) }}
                onAction={() =>
                  launchCommand({ name: "tasks", type: LaunchType.UserInitiated })
                }
              />
            ))}
            <MenuBarExtra.Item
              title="Add Task…"
              icon={Icon.Plus}
              shortcut={{ modifiers: ["cmd"], key: "n" }}
              onAction={() => launchCommand({ name: "add-task", type: LaunchType.UserInitiated })}
            />
          </MenuBarExtra.Section>

          <MenuBarExtra.Section>
            <MenuBarExtra.Item
              title="Open Web App"
              icon={Icon.Globe}
              onAction={() => base && open(base)}
            />
            <MenuBarExtra.Item
              title="Preferences…"
              icon={Icon.Gear}
              onAction={openCommandPreferences}
            />
          </MenuBarExtra.Section>
        </>
      )}
    </MenuBarExtra>
  );
}
