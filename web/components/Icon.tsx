import type { CSSProperties } from "react";

const paths = {
  more: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M7 12h.01 M12 12h.01 M17 12h.01",
  video: "M3 6h12v12H3z M15 10l6-4v12l-6-4",
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  today:
    "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  calendar: "M4 5h16v16H4z M4 10h16 M8 3v4m8-4v4 M8 14h2m4 0h2m-8 3h2",
  tasks: "m3 6 2 2 4-4m-6 9 2 2 4-4m-6 9 2 2 4-4 M12 6h9m-9 7h9m-9 7h9",
  wiki: "M12 5C9 3 6 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1v15",
  agent: "M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z M18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z",
  docs: "M5 3h9l5 5v13H5z M14 3v6h5 M8 13h8m-8 4h6",
  daily: "M5 3h15v18H5z M2 7h5m-5 5h5m-5 5h5 M10 7h6m-6 5h6",
  log: "M3 12h4l3-8 4 16 3-8h4",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6",
  plus: "M12 5v14M5 12h14",
  chevron: "m9 5 7 7-7 7",
  check: "m5 12 4 4L19 6",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 4v5l3 2",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  refresh: "M20 8a8 8 0 1 0 0 8M20 3v5h-5",
  close: "m6 6 12 12M6 18 18 6",
  menu: "M4 6h16M4 12h16M4 18h16",
  list: "M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1",
  board: "M3 4h7v16H3z M14 4h7v10h-7z",
  flag: "M5 21V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0",
} as const;
export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 18,
  style,
  className,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
      className={className}
    >
      <path d={paths[name]} />
    </svg>
  );
}
