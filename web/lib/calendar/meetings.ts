import type { CalEvent } from "./types";

function webUrl(value?: string): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value.trim());
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return;
    return url.href;
  } catch {
    return;
  }
}

const meetingHosts = [
  "meet.google.com",
  "zoom.us",
  "zoom.com",
  "teams.microsoft.com",
  "teams.live.com",
  "teams.cloud.microsoft",
  "webex.com",
  "meet.jit.si",
  "whereby.com",
  "gotomeeting.com",
  "bluejeans.com",
];

export function plainEventText(text = ""): string {
  return text
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?\s*>|<\/(?:p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .trim();
}

export function findMeetingUrl(
  urls: (string | undefined)[] = [],
  text: (string | undefined)[] = [],
): string | undefined {
  for (const candidate of urls) {
    const url = webUrl(candidate);
    if (url) return url;
  }
  for (const value of text) {
    const decoded = (value ?? "")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;|&#(?:39|x27);/gi, '"');
    for (const candidate of decoded.match(/https?:\/\/[^\s<>"']+/gi) ?? []) {
      const url = webUrl(candidate.replace(/[),.;\]}]+$/, ""));
      if (!url) continue;
      const host = new URL(url).hostname.toLowerCase();
      if (
        meetingHosts.some(
          (known) => host === known || host.endsWith(`.${known}`),
        )
      )
        return url;
    }
  }
}

export const eventMeetingUrl = (event: CalEvent) =>
  findMeetingUrl([event.meetingUrl], [event.location, event.description]);
export function meetingLabel(url: string): string {
  const host = new URL(url).hostname;
  if (host === "meet.google.com") return "Google Meet";
  if (/(^|\.)zoom\.(us|com)$/.test(host)) return "Zoom";
  if (host.startsWith("teams.")) return "Microsoft Teams";
  if (/(^|\.)webex.com$/.test(host)) return "Webex";
  return "Video meeting";
}
