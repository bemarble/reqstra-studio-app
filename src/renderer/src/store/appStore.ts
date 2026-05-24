import { create } from 'zustand'

export type Protocol = 'grpc' | 'graphql' | 'http'

export interface Tab {
  id: string
  label: string
  endpointId: string
  caseName: string
}

interface AppState {
  activeProtocol: Protocol
  activeEnvironmentId: string | null
  activeProtocolTargetId: string | null
  openTabs: Tab[]
  activeTabId: string | null
  setActiveProtocol: (protocol: Protocol) => void
  setActiveEnvironmentId: (id: string) => void
  setActiveProtocolTargetId: (id: string) => void
  openTab: (tab: Tab) => void
  closeTab: (id: string) => void
  setActiveTabId: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeProtocol: 'grpc',
  activeEnvironmentId: null,
  activeProtocolTargetId: null,
  openTabs: [],
  activeTabId: null,
  setActiveProtocol: (protocol) => set({ activeProtocol: protocol, openTabs: [], activeTabId: null }),
  setActiveEnvironmentId: (id) => set({ activeEnvironmentId: id }),
  setActiveProtocolTargetId: (id) => set({ activeProtocolTargetId: id }),
  openTab: (tab) =>
    set((state) => {
      if (state.openTabs.find((t) => t.id === tab.id)) {
        return { activeTabId: tab.id }
      }
      return { openTabs: [...state.openTabs, tab], activeTabId: tab.id }
    }),
  closeTab: (id) =>
    set((state) => {
      const tabs = state.openTabs.filter((t) => t.id !== id)
      const activeTabId =
        state.activeTabId === id ? (tabs[tabs.length - 1]?.id ?? null) : state.activeTabId
      return { openTabs: tabs, activeTabId }
    }),
  setActiveTabId: (id) => set({ activeTabId: id }),
}))
