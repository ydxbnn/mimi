function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatFullTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatRelativeTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 2 * day) return '昨天';
  return formatFullTime(ts);
}
