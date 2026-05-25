import { useState, useCallback, useEffect, useRef, type JSX } from 'react'

interface Props {
  defaultLeftWidth: number
  minLeft?: number
  minRight?: number
  storageKey?: string
  children: [React.ReactNode, React.ReactNode]
}

export function ResizablePanes({
  defaultLeftWidth,
  minLeft = 120,
  minRight = 200,
  storageKey,
  children,
}: Props): JSX.Element {
  const stored = storageKey
    ? Number(localStorage.getItem(storageKey)) || defaultLeftWidth
    : defaultLeftWidth
  const [leftWidth, setLeftWidth] = useState<number>(stored)
  const isDragging = useRef<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!isDragging.current || !containerRef.current) return
      const containerLeft = containerRef.current.getBoundingClientRect().left
      const containerWidth = containerRef.current.clientWidth
      const newWidth = Math.max(
        minLeft,
        Math.min(e.clientX - containerLeft, containerWidth - minRight - 4),
      )
      setLeftWidth(newWidth)
      if (storageKey) localStorage.setItem(storageKey, String(newWidth))
    }

    const handleMouseUp = (): void => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [minLeft, minRight, storageKey])

  return (
    <div ref={containerRef} className="flex h-full overflow-hidden">
      <div style={{ width: leftWidth, minWidth: minLeft, flexShrink: 0 }} className="flex flex-col overflow-hidden">
        {children[0]}
      </div>
      <div
        style={{ width: 4, cursor: 'col-resize', flexShrink: 0 }}
        className="bg-transparent transition-colors hover:bg-[var(--color-text-accent)] active:bg-[var(--color-text-accent)]"
        onMouseDown={handleMouseDown}
      />
      <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
        {children[1]}
      </div>
    </div>
  )
}
