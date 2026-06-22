'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AvailableNumber } from '@/lib/api';
import { loadCart, saveCart, toCartItem, type CartItem } from '@/lib/cart';
import { sumCarrierPrices } from '@/lib/pricing';

type CartContextValue = {
  items: CartItem[];
  count: number;
  totals: ReturnType<typeof sumCarrierPrices> & { orderTotal: number };
  addItem: (number: AvailableNumber, countryLabel?: string) => boolean;
  removeItem: (phoneNumber: string) => void;
  clearCart: () => void;
  isInCart: (phoneNumber: string) => boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(loadCart());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveCart(items);
  }, [items, ready]);

  const addItem = useCallback((number: AvailableNumber, countryLabel?: string) => {
    let added = false;
    setItems((prev) => {
      if (prev.some((item) => item.phoneNumber === number.phoneNumber)) return prev;
      added = true;
      return [...prev, toCartItem(number, countryLabel)];
    });
    return added;
  }, []);

  const removeItem = useCallback((phoneNumber: string) => {
    setItems((prev) => prev.filter((item) => item.phoneNumber !== phoneNumber));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const isInCart = useCallback(
    (phoneNumber: string) => items.some((item) => item.phoneNumber === phoneNumber),
    [items],
  );

  const totals = useMemo(() => {
    const carrier = sumCarrierPrices(items);
    return { ...carrier, orderTotal: carrier.upfront + carrier.monthly };
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      count: items.length,
      totals,
      addItem,
      removeItem,
      clearCart,
      isInCart,
    }),
    [items, totals, addItem, removeItem, clearCart, isInCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
