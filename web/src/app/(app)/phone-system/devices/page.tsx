import { redirect } from 'next/navigation';

export default function LegacyDevicesRedirect() {
  redirect('/devices');
}
