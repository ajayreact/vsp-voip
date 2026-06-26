import { create } from 'zustand';
import type { DashboardStats } from '../api/types';

type AppState = {
  isOnline: boolean;
  dashboardStats: DashboardStats | null;
  setOnline: (value: boolean) => void;
  setDashboardStats: (stats: DashboardStats | null) => void;
};

export const useAppStore = create<AppState>((set) => ({
  isOnline: true,
  dashboardStats: null,
  setOnline: (value) => set({ isOnline: value }),
  setDashboardStats: (stats) => set({ dashboardStats: stats }),
}));
