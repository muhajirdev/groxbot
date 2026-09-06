export function formatListTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDaySep(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return `Today ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return `Yesterday ${time}`;
  return `${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} ${time}`;
}

export function dayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

type ChatStamp = Date | number | string | undefined;

/** Pi / Date.now() ms. Drop epoch, seconds, and junk so we never paint "Jan 1970". */
function stampMs(value: ChatStamp): number | null {
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) && t > 1_000_000_000_000 ? t : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 1_000_000_000_000 ? value : null;
  }
  if (typeof value === "string" && value.trim()) {
    const t = new Date(value).getTime();
    return Number.isFinite(t) && t > 1_000_000_000_000 ? t : null;
  }
  return null;
}

const SAME_DAY_GAP_MS = 4 * 60 * 60 * 1000;

/** Day header, or a clock if the same-day gap is long. Empty when time is unknown. */
export function messageDaySep(
  createdAt: ChatStamp,
  previousCreatedAt?: ChatStamp,
): string {
  const t = stampMs(createdAt);
  if (t == null) return "";
  const iso = new Date(t).toISOString();
  const prev = stampMs(previousCreatedAt);
  if (prev == null) return formatDaySep(iso);
  if (dayKey(iso) !== dayKey(new Date(prev).toISOString())) {
    return formatDaySep(iso);
  }
  if (t - prev >= SAME_DAY_GAP_MS) {
    return new Date(t).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return "";
}
