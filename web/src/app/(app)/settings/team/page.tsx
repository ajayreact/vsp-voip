import { redirect } from 'next/navigation';

export default function LegacyTeamRedirect() {
  redirect('/employees');
}
