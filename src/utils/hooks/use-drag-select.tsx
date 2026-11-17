import clsx from 'clsx'
import { useRef, useState } from 'react'
import { useEvent } from 'react-use'
import { getSelectionMode } from '../selection'
import type { SelectionMode } from '../selection'

function captureClick(e: MouseEvent) {
  e.stopPropagation()
  window.removeEventListener('click', captureClick, true)
}

type Options = {
  disabled?: boolean
  className?: string
  onSelect: (box: { x1: number, y1: number, x2: number, y2: number }, mode: SelectionMode) => void
}
export function useDragSelect({
  disabled = false,
  className = '',
  onSelect,
}: Options) {
  const dragging = useRef(false)
  const moving = useRef(false)
  const pointerId = useRef<number | null>(null)
  const mode = useRef<SelectionMode>('replace')
  const start = useRef<[number, number]>([0, 0])
  const [rect, setRect] = useState({ x: 0, y: 0, width: 0, height: 0 })

  const handlePointerUp = (event: PointerEvent) => {
    if (!dragging.current || event.pointerId !== pointerId.current) {
      return
    }
    // should fire onMouseMove at least once
    if (!moving.current) {
      dragging.current = false
      pointerId.current = null
      return
    }
    const { x, y, width, height } = rect
    if (event.type !== 'pointercancel' && Math.hypot(width, height) > 5) {
      // prevent click event on node
      window.addEventListener('click', captureClick, true)
      onSelect({ x1: x, y1: y, x2: x + width, y2: y + height }, mode.current)
    }
    dragging.current = false
    pointerId.current = null
    moving.current = false
    setRect({ x: 0, y: 0, width: 0, height: 0 })
  }

  useEvent('pointerup', handlePointerUp)
  useEvent('pointercancel', handlePointerUp)

  const bindings = {
    onPointerDownCapture: (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || (e.button !== 0 && e.button !== undefined)) {
        return
      }
      if (getSelectionMode(e) === 'replace' && (e.target as Element).closest('[data-drag-node-id]')) {
        return
      }
      const bounds = e.currentTarget.getBoundingClientRect()
      const offsetX = e.clientX - bounds.left
      const offsetY = e.clientY - bounds.top
      dragging.current = true
      pointerId.current = e.pointerId
      mode.current = getSelectionMode(e)
      start.current = [offsetX, offsetY]
    },
    onPointerMoveCapture: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current || e.pointerId !== pointerId.current) {
        return
      }
      moving.current = true
      const bounds = e.currentTarget.getBoundingClientRect()
      const offsetX = e.clientX - bounds.left
      const offsetY = e.clientY - bounds.top
      const x = offsetX > start.current[0] ? start.current[0] : offsetX
      const y = offsetY > start.current[1] ? start.current[1] : offsetY
      const width = Math.abs(offsetX - start.current[0])
      const height = Math.abs(offsetY - start.current[1])
      setRect({ x, y, width, height })
    },
  }
  const { x, y, width, height } = rect
  const Selection = (width > 0 || height > 0) && (
    <div
      data-testid="selection-box"
      style={{
        top: `${y}px`,
        left: `${x}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
      className={clsx('absolute pointer-events-none', className)}
    >
    </div>
  )
  return [bindings, Selection]
}
