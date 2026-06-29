export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

export function isToday(iso: string | Date, now = new Date()): boolean {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return false;
  return startOfDay(d).getTime() === startOfDay(now).getTime();
}

export function isThisWeek(iso: string | Date, now = new Date()): boolean {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() >= startOfWeek(now).getTime();
}

export function isWithinHours(iso: string | Date, hours: number, now = new Date()): boolean {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return false;
  return now.getTime() - d.getTime() <= hours * 60 * 60 * 1000;
}
