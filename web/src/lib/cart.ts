import type { AvailableNumber } from '@/lib/api';

export type CartItem = AvailableNumber & {
  countryLabel: string;
};

const STORAGE_KEY = 'vsp_number_cart';

export function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function toCartItem(number: AvailableNumber, countryLabel = 'United States (+1)'): CartItem {
  return { ...number, countryLabel };
}
