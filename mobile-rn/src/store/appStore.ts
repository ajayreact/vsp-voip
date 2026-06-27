import { create } from 'zustand';
import type { DashboardStats } from '../api/types';

export type NetworkRecoveryState = 'idle' | 'connected';

type AppState = {
  isOnline: boolean;
  networkRecovery: NetworkRecoveryState;
  dashboardStats: DashboardStats | null;
  setOnline: (value: boolean) => void;
  markNetworkRecovered: () => void;
  clearNetworkRecovery: () => void;
  setDashboardStats: (stats: DashboardStats | null) => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  isOnline: false,
  networkRecovery: 'idle',
  dashboardStats: null,
  setOnline: (value) => {
    const wasOffline = !get().isOnline;
    if (value && wasOffline) {
      set({ isOnline: value, networkRecovery: 'connected' });
      return;
    }
    set({ isOnline: value, networkRecovery: value ? get().networkRecovery : 'idle' });
  },
  markNetworkRecovered: () => set({ networkRecovery: 'idle' }),
  clearNetworkRecovery: () => set({ networkRecovery: 'idle' }),
  setDashboardStats: (stats) => set({ dashboardStats: stats }),
}));
