/** Human-readable labels for callType values (mirrors lib/callLogMeta.js). */
export function callTypeDisplayLabel(callType: string) {
  switch (String(callType || '').toLowerCase()) {
    case 'missed':
      return 'Missed';
    case 'outbound_no_answer':
      return 'No Answer';
    case 'busy':
      return 'Busy';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    case 'rejected':
      return 'Rejected';
    case 'answered':
      return 'Inbound';
    case 'inbound':
      return 'Inbound';
    case 'outbound':
      return 'Outbound';
    default:
      return callType
        ? String(callType).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : 'Unknown';
  }
}

export function callTypeBadgeClass(type: string) {
  switch (String(type || '').toLowerCase()) {
    case 'missed':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'outbound_no_answer':
    case 'busy':
    case 'failed':
    case 'cancelled':
    case 'rejected':
      return 'bg-orange-50 text-orange-700 ring-orange-200';
    case 'outbound':
      return 'bg-sky-50 text-sky-700 ring-sky-200';
    default:
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }
}
