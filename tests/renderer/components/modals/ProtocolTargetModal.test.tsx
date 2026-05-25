import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { ProtocolTargetModal } from '../../../../src/renderer/src/components/modals/ProtocolTargetModal'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ProtocolTargetModal — grpc', () => {
  it('名前/ホストが空の時は追加ボタンが無効', () => {
    render(<ProtocolTargetModal mode="add" protocol="grpc" onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: '追加' })).toBeDisabled()
  })

  it('gRPCターゲットを追加するとonSubmitが呼ばれる', () => {
    const onSubmit = vi.fn()
    render(<ProtocolTargetModal mode="add" protocol="grpc" onSubmit={onSubmit} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('例: Local gRPC'), { target: { value: 'Local' } })
    fireEvent.change(screen.getByPlaceholderText('例: localhost:50051'), { target: { value: 'localhost:50051' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Local', host: 'localhost:50051', secure: false }),
    )
  })

  it('TLSチェックボックスを切り替えると secure が変わる', () => {
    const onSubmit = vi.fn()
    render(<ProtocolTargetModal mode="add" protocol="grpc" onSubmit={onSubmit} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('例: Local gRPC'), { target: { value: 'Local' } })
    fireEvent.change(screen.getByPlaceholderText('例: localhost:50051'), { target: { value: 'localhost:50051' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ secure: true }))
  })

  it('editモードでは既存の値が初期表示される', () => {
    const target = { id: 'grpc-1', name: 'Local', host: 'localhost:50051', secure: false }
    render(
      <ProtocolTargetModal mode="edit" protocol="grpc" initial={target} onSubmit={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.getByDisplayValue('Local')).toBeInTheDocument()
    expect(screen.getByDisplayValue('localhost:50051')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
  })

  it('削除ボタンをクリックすると確認後にonDeleteが呼ばれる', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onDelete = vi.fn()
    const target = { id: 'grpc-1', name: 'Local', host: 'localhost:50051', secure: false }
    render(
      <ProtocolTargetModal
        mode="edit"
        protocol="grpc"
        initial={target}
        onSubmit={vi.fn()}
        onDelete={onDelete}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(onDelete).toHaveBeenCalled()
  })

  it('削除確認でキャンセルするとonDeleteは呼ばれない', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onDelete = vi.fn()
    const target = { id: 'grpc-1', name: 'Local', host: 'localhost:50051', secure: false }
    render(
      <ProtocolTargetModal
        mode="edit"
        protocol="grpc"
        initial={target}
        onSubmit={vi.fn()}
        onDelete={onDelete}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('キャンセルボタンでonCloseが呼ばれる', () => {
    const onClose = vi.fn()
    render(<ProtocolTargetModal mode="add" protocol="grpc" onSubmit={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('ProtocolTargetModal — http', () => {
  it('HTTPターゲットを追加するとonSubmitに baseUrl が含まれる', () => {
    const onSubmit = vi.fn()
    render(<ProtocolTargetModal mode="add" protocol="http" onSubmit={onSubmit} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('例: REST API'), { target: { value: 'REST API' } })
    fireEvent.change(screen.getByPlaceholderText('例: http://localhost:3000'), {
      target: { value: 'http://localhost:3000' },
    })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'REST API', baseUrl: 'http://localhost:3000' }),
    )
  })
})

describe('ProtocolTargetModal — graphql', () => {
  it('GraphQLターゲットを追加するとonSubmitに host が含まれる', () => {
    const onSubmit = vi.fn()
    render(<ProtocolTargetModal mode="add" protocol="graphql" onSubmit={onSubmit} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('例: GraphQL API'), { target: { value: 'GraphQL' } })
    fireEvent.change(screen.getByPlaceholderText('例: http://localhost:4000/graphql'), {
      target: { value: 'http://localhost:4000/graphql' },
    })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'GraphQL', host: 'http://localhost:4000/graphql' }),
    )
  })
})
