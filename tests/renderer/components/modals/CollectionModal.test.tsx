import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { CollectionModal } from '../../../../src/renderer/src/components/modals/CollectionModal'
import type { Environment } from '../../../../src/shared/types/project'

afterEach(() => { vi.restoreAllMocks() })

const mockEnv: Environment = {
  id: 'env-1',
  name: 'dev',
  protocols: {
    grpc: [{ id: 'grpc-1', name: 'Local gRPC', host: 'localhost:50051', secure: false }],
    http: [{ id: 'http-1', name: 'REST API', baseUrl: 'http://localhost:3000' }],
  },
}

describe('CollectionModal', () => {
  it('名前が空の時は追加ボタンが無効', () => {
    render(<CollectionModal mode="add" environment={mockEnv} onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: '追加' })).toBeDisabled()
  })

  it('名前を入力して追加するとonSubmitが呼ばれる', () => {
    const onSubmit = vi.fn()
    render(<CollectionModal mode="add" environment={mockEnv} onSubmit={onSubmit} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('例: UserService'), { target: { value: 'UserService' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'UserService', protocol: 'grpc', endpoints: [] }),
    )
  })

  it('editモードではプロトコルが変更不可', () => {
    const collection = {
      id: 'col-1',
      protocol: 'grpc' as const,
      name: 'UserService',
      protocolTargetId: 'grpc-1',
      endpoints: [],
    }
    render(<CollectionModal mode="edit" initial={collection} environment={mockEnv} onSubmit={vi.fn()} onClose={vi.fn()} />)
    const protocolSelect = screen.getByDisplayValue('gRPC')
    expect(protocolSelect).toBeDisabled()
  })

  it('editモードでは既存の値が初期表示される', () => {
    const collection = {
      id: 'col-1',
      protocol: 'grpc' as const,
      name: 'UserService',
      protocolTargetId: 'grpc-1',
      endpoints: [],
    }
    render(<CollectionModal mode="edit" initial={collection} environment={mockEnv} onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByDisplayValue('UserService')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
  })

  it('キャンセルボタンでonCloseが呼ばれる', () => {
    const onClose = vi.fn()
    render(<CollectionModal mode="add" environment={mockEnv} onSubmit={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(onClose).toHaveBeenCalled()
  })
})
