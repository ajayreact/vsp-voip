const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function defaultBusinessHours() {
  const weekday = { enabled: true, open: '09:00', close: '17:00' };
  const weekend = { enabled: false, open: '09:00', close: '17:00' };
  return {
    mon: { ...weekday },
    tue: { ...weekday },
    wed: { ...weekday },
    thu: { ...weekday },
    fri: { ...weekday },
    sat: { ...weekend },
    sun: { ...weekend },
  };
}

function parseTimeToMinutes(value) {
  if (!value || typeof value !== 'string') return null;
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function getLocalDayAndMinutes(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value?.toLowerCase().slice(0, 3);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  const dayMap = { sun: 'sun', mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri', sat: 'sat' };
  const dayKey = dayMap[weekday] || 'mon';
  return { dayKey, minutes: hour * 60 + minute };
}

function isWithinBusinessHours(schedule, timezone) {
  const hours = schedule && typeof schedule === 'object' ? schedule : defaultBusinessHours();
  const { dayKey, minutes } = getLocalDayAndMinutes(new Date(), timezone);
  const day = hours[dayKey];
  if (!day?.enabled) return false;

  const openMinutes = parseTimeToMinutes(day.open);
  const closeMinutes = parseTimeToMinutes(day.close);
  if (openMinutes == null || closeMinutes == null) return true;

  if (closeMinutes <= openMinutes) {
    return minutes >= openMinutes || minutes < closeMinutes;
  }
  return minutes >= openMinutes && minutes < closeMinutes;
}

module.exports = {
  DAY_KEYS,
  defaultBusinessHours,
  isWithinBusinessHours,
};
