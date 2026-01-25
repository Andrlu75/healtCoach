import { create } from 'zustand'

interface BottomSheetState {
  isOpen: boolean
  content: React.ReactNode | null
}

interface UIState {
  bottomSheet: BottomSheetState
  openBottomSheet: (content: React.ReactNode) => void
  closeBottomSheet: () => void
  isRefreshing: boolean
  setRefreshing: (value: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  bottomSheet: {
    isOpen: false,
    content: null,
  },
  openBottomSheet: (content) =>
    set({ bottomSheet: { isOpen: true, content } }),
  closeBottomSheet: () =>
    set({ bottomSheet: { isOpen: false, content: null } }),
  isRefreshing: false,
  setRefreshing: (value) => set({ isRefreshing: value }),
}))
