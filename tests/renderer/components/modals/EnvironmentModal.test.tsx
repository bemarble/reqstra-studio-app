import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { EnvironmentModal } from '../../../../src/renderer/src/components/modals/EnvironmentModal'

describe('EnvironmentModal', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('名前が空の時は追加ボタンが無効', () => {
    render(<EnvironmentModal mode="add" onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: '追加' })).toBeDisabled()
  })

  it('名前を入力して追加するとonSubmitが呼ばれる', () => {
    const onSubmit = vi.fn()
    render(<EnvironmentModal mode="add" onSubmit={onSubmit} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('例: dev'), { target: { value: 'staging' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'staging', protocols: {} }))
  })

  it('editモードでは既存の名前が初期表示される', () => {
    const env = { id: 'env-1', name: 'dev', protocols: {} }
    render(<EnvironmentModal mode="edit" initial={env} onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByDisplayValue('dev')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
  })

  it('editモードの削除ボタンをクリックすると確認後にonDeleteが呼ばれる', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onDelete = vi.fn()
    const env = { id: 'env-1', name: 'dev', protocols: {} }
    render(<EnvironmentModal mode="edit" initial={env} onSubmit={vi.fn()} onDelete={onDelete} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(window.confirm).toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalled()
  })

  it('削除確認でキャンセルするとonDeleteは呼ばれない', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onDelete = vi.fn()
    const env = { id: 'env-1', name: 'dev', protocols: {} }
    render(<EnvironmentModal mode="edit" initial={env} onSubmit={vi.fn()} onDelete={onDelete} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('キャンセルボタンでonCloseが呼ばれる', () => {
    const onClose = vi.fn()
    render(<EnvironmentModal mode="add" onSubmit={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('deleteWarningがある場合は確認メッセージに警告が含まれる', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const env = { id: 'env-1', name: 'dev', protocols: {} }
    render(
      <EnvironmentModal
        mode="edit"
        initial={env}
        onSubmit={vi.fn()}
        onDelete={vi.fn()}
        deleteWarning="以下のコレクションがこの環境のターゲットを参照しています: UserService"
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('UserService'),
    )
  })
})
