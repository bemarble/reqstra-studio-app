import { useState, useCallback, useEffect, useRef, type JSX } from 'react'

interface Props {
  defaultLeftWidth: number
  minLeft?: number
  minRight?: number
  storageKey?: string
  direction?: 'horizontal' | 'vertical'
  children: [React.ReactNode, React.ReactNode]
}

export function ResizablePanes({
  defaultLeftWidth,
  minLeft = 120,
  minRight = 200,
  storageKey,
  direction = 'horizontal',
  children,
}: Props): JSX.Element {
  const stored = storageKey
    ? Number(localStorage.getItem(storageKey)) || defaultLeftWidth
    : defaultLeftWidth
  const [firstSize, setFirstSize] = useState<number>(stored)
  const isDragging = useRef<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const isHorizontal = direction === 'horizontal'

  const handleMouseDown = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }, [isHorizontal])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const offset = isHorizontal ? e.clientX - rect.left : e.clientY - rect.top
      const total = isHorizontal ? containerRef.current.clientWidth : containerRef.current.clientHeight
      const newSize = Math.max(minLeft, Math.min(offset, total - minRight - 4))
      setFirstSize(newSize)
      if (storageKey) localStorage.setItem(storageKey, String(newSize))
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
  }, [minLeft, minRight, storageKey, isHorizontal])

  const dividerStyle = isHorizontal
    ? { width: 4, cursor: 'col-resize', flexShrink: 0 }
    : { height: 4, cursor: 'row-resize', flexShrink: 0 }

  const firstStyle = isHorizontal
    ? { width: firstSize, minWidth: minLeft, flexShrink: 0 }
    : { height: firstSize, minHeight: minLeft, flexShrink: 0 }

  return (
    <div
      ref={containerRef}
      className={`${isHorizontal ? 'flex' : 'flex flex-col'} h-full min-w-0 flex-1 overflow-hidden`}
    >
      <div style={firstStyle} className="flex flex-col overflow-hidden">
        {children[0]}
      </div>
      <div
        style={dividerStyle}
        className="bg-transparent transition-colors hover:bg-[var(--color-text-accent)] active:bg-[var(--color-text-accent)]"
        onMouseDown={handleMouseDown}
      />
      <div className={`${isHorizontal ? 'min-w-0' : 'min-h-0'} flex-1 flex flex-col overflow-hidden`}>
        {children[1]}
      </div>
    </div>
  )
}
