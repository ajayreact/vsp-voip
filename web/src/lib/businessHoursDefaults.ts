export type BusinessDayHours = {
  enabled: boolean;
  open: string;
  close: string;
};

export type BusinessHoursSchedule = Record<string, BusinessDayHours>;

export function defaultBusinessHours(): BusinessHoursSchedule {
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
