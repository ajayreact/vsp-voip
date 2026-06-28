import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LegacyRingGroupDetailRedirect({ params }: PageProps) {
  const { id } = await params;
  redirect(`/ring-groups/${id}`);
}
