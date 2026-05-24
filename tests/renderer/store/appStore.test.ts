import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAppStore } from '../../../src/renderer/src/store/appStore'

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeProtocol: 'grpc',
      activeEnvironmentId: null,
      activeProtocolTargetId: null,
      openTabs: [],
      activeTabId: null,
    })
  })

  it('プロトコルを切り替える', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.setActiveProtocol('http'))
    expect(result.current.activeProtocol).toBe('http')
  })

  it('タブを開く', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.openTab({ id: 'tab-1', label: 'GetUser', endpointId: 'ep-1', caseName: 'UserA' }))
    expect(result.current.openTabs).toHaveLength(1)
    expect(result.current.activeTabId).toBe('tab-1')
  })

  it('同じタブを二重に開かない', () => {
    const { result } = renderHook(() => useAppStore())
    const tab = { id: 'tab-1', label: 'GetUser', endpointId: 'ep-1', caseName: 'UserA' }
    act(() => result.current.openTab(tab))
    act(() => result.current.openTab(tab))
    expect(result.current.openTabs).toHaveLength(1)
  })

  it('タブを閉じる', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.openTab({ id: 'tab-1', label: 'GetUser', endpointId: 'ep-1', caseName: 'UserA' }))
    act(() => result.current.closeTab('tab-1'))
    expect(result.current.openTabs).toHaveLength(0)
    expect(result.current.activeTabId).toBeNull()
  })
})
