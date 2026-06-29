export type TimeGreeting = 'Good Morning' | 'Good Afternoon' | 'Good Evening';

export function getTimeGreeting(date = new Date()): TimeGreeting {
  const hour = date.getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}
