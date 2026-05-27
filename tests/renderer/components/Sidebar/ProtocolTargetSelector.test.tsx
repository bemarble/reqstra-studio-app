import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { ProtocolTargetSelector } from '../../../../src/renderer/src/components/Sidebar/ProtocolTargetSelector'
import { useProjectStore } from '../../../../src/renderer/src/store/projectStore'
import { useAppStore } from '../../../../src/renderer/src/store/appStore'

const mockSaveProject = vi.fn()

Object.defineProperty(window, 'reqstraApi', {
  value: { saveProject: mockSaveProject },
  writable: true,
})

const projectWithGrpcTargets = {
  name: 'test',
  projectDir: '/tmp/test',
  environments: [
    {
      id: 'env-1',
      name: 'dev',
      protocols: {
        grpc: [
          { id: 'grpc-1', name: 'Local', host: 'localhost:50051', secure: false },
          { id: 'grpc-2', name: 'Staging', host: 'staging:50051', secure: true },
        ],
      },
    },
  ],
  collections: [],
}

describe('ProtocolTargetSelector', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: projectWithGrpcTargets })
    mockSaveProject.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('activeProtocolTargetIdがnullのとき最初のターゲットIDをストアに同期する', () => {
    useAppStore.setState({
      activeProtocol: 'grpc',
      activeEnvironmentId: 'env-1',
      activeProtocolTargetId: null,
      openTabs: [],
      activeTabId: null,
    })

    render(<ProtocolTargetSelector />)

    expect(useAppStore.getState().activeProtocolTargetId).toBe('grpc-1')
  })

  it('activeProtocolTargetIdが既存のターゲットIDと一致するとき変更しない', () => {
    useAppStore.setState({
      activeProtocol: 'grpc',
      activeEnvironmentId: 'env-1',
      activeProtocolTargetId: 'grpc-2',
      openTabs: [],
      activeTabId: null,
    })

    render(<ProtocolTargetSelector />)

    expect(useAppStore.getState().activeProtocolTargetId).toBe('grpc-2')
  })

  it('ターゲットが0件のとき何もしない', () => {
    useProjectStore.setState({
      project: {
        ...projectWithGrpcTargets,
        environments: [{ id: 'env-1', name: 'dev', protocols: {} }],
      },
    })
    useAppStore.setState({
      activeProtocol: 'grpc',
      activeEnvironmentId: 'env-1',
      activeProtocolTargetId: null,
      openTabs: [],
      activeTabId: null,
    })

    render(<ProtocolTargetSelector />)

    expect(useAppStore.getState().activeProtocolTargetId).toBeNull()
  })
})
