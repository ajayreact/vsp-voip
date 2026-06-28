'use client';

import { useParams } from 'next/navigation';
import { RingGroupDetailPage } from '@/components/portal/ring-group-detail';

export default function RingGroupDetailRoute() {
  const params = useParams();
  const id = String(params.id);
  return <RingGroupDetailPage groupId={id} />;
}
