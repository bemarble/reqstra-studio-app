import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { EnvironmentSelector } from '../../../../src/renderer/src/components/Sidebar/EnvironmentSelector'
import { useProjectStore } from '../../../../src/renderer/src/store/projectStore'
import { useAppStore } from '../../../../src/renderer/src/store/appStore'

const mockSaveProject = vi.fn()

Object.defineProperty(window, 'reqstraApi', {
  value: { saveProject: mockSaveProject },
  writable: true,
})

describe('EnvironmentSelector', () => {
  beforeEach(() => {
    useProjectStore.setState({
      project: {
        name: 'test',
        projectDir: '/tmp/test',
        environments: [{ id: 'env-1', name: 'dev', protocols: {} }],
        collections: [],
      },
    })
    useAppStore.setState({
      activeProtocol: 'grpc',
      activeEnvironmentId: 'env-1',
      activeProtocolTargetId: null,
      openTabs: [],
      activeTabId: null,
    })
    mockSaveProject.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('✎ボタンが表示される', () => {
    render(<EnvironmentSelector />)
    expect(screen.getByTitle('環境を編集')).toBeInTheDocument()
  })

  it('＋ボタンが表示される', () => {
    render(<EnvironmentSelector />)
    expect(screen.getByTitle('環境を追加')).toBeInTheDocument()
  })

  it('✎ボタンをクリックすると編集モーダルが表示される', () => {
    render(<EnvironmentSelector />)
    fireEvent.click(screen.getByTitle('環境を編集'))
    expect(screen.getByText('環境を編集')).toBeInTheDocument()
  })

  it('＋ボタンをクリックすると追加モーダルが表示される', () => {
    render(<EnvironmentSelector />)
    fireEvent.click(screen.getByTitle('環境を追加'))
    expect(screen.getByText('環境を追加')).toBeInTheDocument()
  })

  it('新しい環境名を入力して追加するとsaveProjectが呼ばれる', async () => {
    render(<EnvironmentSelector />)
    fireEvent.click(screen.getByTitle('環境を追加'))
    fireEvent.change(screen.getByPlaceholderText('例: dev'), { target: { value: 'staging' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '追加' }))
    })
    expect(mockSaveProject).toHaveBeenCalled()
  })

  it('saveProject失敗時にエラーメッセージを表示する', async () => {
    mockSaveProject.mockRejectedValue(new Error('Save failed'))
    render(<EnvironmentSelector />)
    fireEvent.click(screen.getByTitle('環境を追加'))
    fireEvent.change(screen.getByPlaceholderText('例: dev'), { target: { value: 'staging' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '追加' }))
    })
    expect(screen.getByText('Save failed')).toBeInTheDocument()
  })
})
