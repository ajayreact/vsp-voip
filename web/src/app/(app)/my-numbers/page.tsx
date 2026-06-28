import { redirect } from 'next/navigation';

export default function LegacyMyNumbersRedirect() {
  redirect('/phone-numbers');
}
