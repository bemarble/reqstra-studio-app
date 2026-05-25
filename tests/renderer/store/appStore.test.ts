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
    act(() =>
      result.current.openTab({
        type: 'case',
        id: 'tab-1',
        label: 'GetUser',
        endpointId: 'ep-1',
        caseName: 'UserA.yaml',
      }),
    )
    expect(result.current.openTabs).toHaveLength(1)
    expect(result.current.activeTabId).toBe('tab-1')
  })

  it('同じタブを二重に開かない', () => {
    const { result } = renderHook(() => useAppStore())
    const tab = {
      type: 'case' as const,
      id: 'tab-1',
      label: 'GetUser',
      endpointId: 'ep-1',
      caseName: 'UserA.yaml',
    }
    act(() => result.current.openTab(tab))
    act(() => result.current.openTab(tab))
    expect(result.current.openTabs).toHaveLength(1)
  })

  it('タブを閉じる', () => {
    const { result } = renderHook(() => useAppStore())
    act(() =>
      result.current.openTab({
        type: 'case',
        id: 'tab-1',
        label: 'GetUser',
        endpointId: 'ep-1',
        caseName: 'UserA.yaml',
      }),
    )
    act(() => result.current.closeTab('tab-1'))
    expect(result.current.openTabs).toHaveLength(0)
    expect(result.current.activeTabId).toBeNull()
  })

  it('複数タブがある時にアクティブタブを閉じると最後のタブがアクティブになる', () => {
    const { result } = renderHook(() => useAppStore())
    act(() =>
      result.current.openTab({
        type: 'case',
        id: 'tab-1',
        label: 'GetUser',
        endpointId: 'ep-1',
        caseName: 'UserA.yaml',
      }),
    )
    act(() =>
      result.current.openTab({
        type: 'case',
        id: 'tab-2',
        label: 'ListUsers',
        endpointId: 'ep-2',
        caseName: 'All.yaml',
      }),
    )
    act(() => result.current.closeTab('tab-2'))
    expect(result.current.openTabs).toHaveLength(1)
    expect(result.current.activeTabId).toBe('tab-1')
  })

  it('スクラッチタブを開く', () => {
    const { result } = renderHook(() => useAppStore())
    act(() =>
      result.current.openTab({
        type: 'scratch',
        id: 'scratch::ep-1',
        label: 'GetUser',
        endpointId: 'ep-1',
      }),
    )
    expect(result.current.openTabs).toHaveLength(1)
    expect(result.current.openTabs[0].type).toBe('scratch')
    expect(result.current.activeTabId).toBe('scratch::ep-1')
  })

  it('replaceTab でスクラッチタブをケースタブに変換する', () => {
    const { result } = renderHook(() => useAppStore())
    act(() =>
      result.current.openTab({
        type: 'scratch',
        id: 'scratch::ep-1',
        label: 'GetUser',
        endpointId: 'ep-1',
      }),
    )
    act(() =>
      result.current.replaceTab('scratch::ep-1', {
        type: 'case',
        id: 'ep-1::test.yaml',
        label: 'GetUser / test',
        endpointId: 'ep-1',
        caseName: 'test.yaml',
      }),
    )
    expect(result.current.openTabs).toHaveLength(1)
    expect(result.current.openTabs[0].type).toBe('case')
    expect(result.current.activeTabId).toBe('ep-1::test.yaml')
  })
})
