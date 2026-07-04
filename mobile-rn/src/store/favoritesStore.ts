import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const FAVORITES_KEY = 'vsp.contactFavorites';

type FavoritesState = {
  favoriteIds: string[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  isFavorite: (id: string) => boolean;
  toggleFavoriteContact: (contact: { id: string; kind: 'company' | 'customer' }) => Promise<void>;
  isFavoriteContact: (contact: { id: string; kind: 'company' | 'customer' }) => boolean;
};

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favoriteIds: [],
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(FAVORITES_KEY);
      set({
        favoriteIds: raw ? JSON.parse(raw) : [],
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  toggleFavorite: async (id) => {
    const current = get().favoriteIds;
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    set({ favoriteIds: next });
  },

  isFavorite: (id) => get().favoriteIds.includes(id),

  toggleFavoriteContact: async (contact: { id: string; kind: 'company' | 'customer' }) => {
    const key = contact.kind === 'customer' ? `customer:${contact.id}` : contact.id;
    await get().toggleFavorite(key);
  },

  isFavoriteContact: (contact: { id: string; kind: 'company' | 'customer' }) => {
    const key = contact.kind === 'customer' ? `customer:${contact.id}` : contact.id;
    return get().isFavorite(key);
  },
}));
