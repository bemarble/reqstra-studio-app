import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { EndpointModal } from '../../../../src/renderer/src/components/modals/EndpointModal'

afterEach(() => { vi.restoreAllMocks() })

describe('EndpointModal', () => {
  it('名前/メソッドが空の時は追加ボタンが無効', () => {
    render(<EndpointModal mode="add" protocol="grpc" onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: '追加' })).toBeDisabled()
  })

  it('名前とメソッドを入力して追加するとonSubmitが呼ばれる', () => {
    const onSubmit = vi.fn()
    render(<EndpointModal mode="add" protocol="grpc" onSubmit={onSubmit} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('例: GetUser'), { target: { value: 'GetUser' } })
    fireEvent.change(screen.getByPlaceholderText('例: UserService/GetUser'), {
      target: { value: 'UserService/GetUser' },
    })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'GetUser',
        method: 'UserService/GetUser',
        casesDir: 'requests/grpc/UserService/GetUser',
      }),
    )
  })

  it('メソッドを入力するとcasesDirが自動表示される', () => {
    render(<EndpointModal mode="add" protocol="grpc" onSubmit={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('例: UserService/GetUser'), {
      target: { value: 'UserService/GetUser' },
    })
    expect(screen.getByText('requests/grpc/UserService/GetUser')).toBeInTheDocument()
  })

  it('editモードでは既存の値が初期表示される', () => {
    const ep = {
      id: 'ep-1',
      name: 'GetUser',
      method: 'UserService/GetUser',
      casesDir: 'requests/grpc/UserService/GetUser',
    }
    render(<EndpointModal mode="edit" protocol="grpc" initial={ep} onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByDisplayValue('GetUser')).toBeInTheDocument()
    expect(screen.getByDisplayValue('UserService/GetUser')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
  })

  it('キャンセルボタンでonCloseが呼ばれる', () => {
    const onClose = vi.fn()
    render(<EndpointModal mode="add" protocol="grpc" onSubmit={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(onClose).toHaveBeenCalled()
  })
})
