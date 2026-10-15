/** Calendar dates stay dates: never convert a task deadline through UTC. */
export function validTaskDate(value: unknown): value is string {
  if (value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dueLabel(value: string, today: string): string {
  if (!value) return "No date";
  if (value === today) return "Today";
  if (value === shiftDate(today, 1)) return "Tomorrow";
  if (value === shiftDate(today, -1)) return "Yesterday";
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(value.slice(0, 4) !== today.slice(0, 4)
      ? { year: "numeric" as const }
      : {}),
  });
}
