import { create } from 'zustand'

export type Protocol = 'grpc' | 'graphql' | 'http'

export interface CaseTab {
  type: 'case'
  id: string
  label: string
  endpointId: string
  caseName: string
}

export interface ScratchTab {
  type: 'scratch'
  id: string
  label: string
  endpointId: string
}

export type Tab = CaseTab | ScratchTab

export type SaveStatus = 'idle' | 'saving' | 'saved'

interface AppState {
  activeProtocol: Protocol
  activeEnvironmentId: string | null
  activeProtocolTargetId: string | null
  openTabs: Tab[]
  activeTabId: string | null
  saveStatus: SaveStatus
  saveLabel: string | null
  setActiveProtocol: (protocol: Protocol) => void
  setActiveEnvironmentId: (id: string | null) => void
  setActiveProtocolTargetId: (id: string | null) => void
  openTab: (tab: Tab) => void
  closeTab: (id: string) => void
  replaceTab: (oldId: string, newTab: Tab) => void
  setActiveTabId: (id: string) => void
  setSaveStatus: (status: SaveStatus, label?: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeProtocol: 'grpc',
  activeEnvironmentId: null,
  activeProtocolTargetId: null,
  openTabs: [],
  activeTabId: null,
  saveStatus: 'idle',
  saveLabel: null,
  setActiveProtocol: (protocol) =>
    set({ activeProtocol: protocol, openTabs: [], activeTabId: null }),
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
  replaceTab: (oldId, newTab) =>
    set((state) => ({
      openTabs: state.openTabs.map((t) => (t.id === oldId ? newTab : t)),
      activeTabId: state.activeTabId === oldId ? newTab.id : state.activeTabId,
    })),
  setActiveTabId: (id) => set({ activeTabId: id }),
  setSaveStatus: (status, label) =>
    set((state) => ({
      saveStatus: status,
      saveLabel: label !== undefined ? label : state.saveLabel,
    })),
}))
