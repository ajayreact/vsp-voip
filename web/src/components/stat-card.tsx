export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'green' | 'blue' | 'orange' | 'red' | 'indigo';
}) {
  const accentClass = {
    green: 'text-indigo-600',
    blue: 'text-blue-600',
    orange: 'text-amber-600',
    red: 'text-red-600',
    indigo: 'text-indigo-600',
  }[accent || 'indigo'];

  return (
    <div className="panel-card p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accentClass}`}>{value}</p>
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
