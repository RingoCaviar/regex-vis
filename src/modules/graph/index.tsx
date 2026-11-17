import React, { useEffect, useRef, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { ExclamationTriangleIcon } from '@radix-ui/react-icons'
import { useTranslation } from 'react-i18next'
import ASTGraph from './ast-graph'
import { chooseDropCandidate } from './drop-candidate'
import type { DropCandidate } from './drop-candidate'
import type { AST, DropPosition } from '@/parser'
import { canMoveNodes, getContiguousNodesByIds, moveNodes } from '@/parser'
import { clearSelectedAtom, selectNodesByBoxAtom, selectedIdsAtom } from '@/atom'
import { useDragSelect } from '@/utils/hooks'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

type Props = {
  ast: AST.Regex
  errorMsg?: string | null
  onMoveNodes: (ast: AST.Regex) => void
}

type DragState = {
  pointerId: number
  nodeIds: string[]
  label: string
  x: number
  y: number
}

type PendingDrag = DragState & { startX: number, startY: number }

function contiguousDragIds(ast: AST.Regex, pressedId: string, selectedIds: string[]) {
  if (!selectedIds.includes(pressedId))
    return [pressedId]
  return getContiguousNodesByIds(ast, selectedIds).length > 0
    ? selectedIds
    : [pressedId]
}

function readDropPosition(target: SVGElement): DropPosition | null {
  const { dropContainerId, dropSequenceIndex, dropIndex, dropKind } = target.dataset
  const sequenceIndex = Number(dropSequenceIndex)
  const index = Number(dropIndex)
  if (
    !dropContainerId
    || !Number.isInteger(sequenceIndex)
    || !Number.isInteger(index)
    || !['insert', 'branch-before', 'branch-after'].includes(dropKind || '')
  ) {
    return null
  }
  return {
    containerId: dropContainerId,
    sequenceIndex,
    index,
    kind: dropKind as NonNullable<DropPosition['kind']>,
  }
}

const Graph: React.FC<Props> = ({ ast, errorMsg = null, onMoveNodes }) => {
  const { t } = useTranslation()
  const selectNodesByBox = useSetAtom(selectNodesByBoxAtom)
  const clearSelected = useSetAtom(clearSelectedAtom)
  const selectedIds = useAtomValue(selectedIdsAtom)
  const [previewAst, setPreviewAst] = useState<AST.Regex | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const pendingDragRef = useRef<PendingDrag | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  const previewRef = useRef<AST.Regex | null>(null)
  const [activeCandidate, setActiveCandidate] = useState<DropCandidate | null>(null)
  const activeDropKeyRef = useRef<string | null>(null)
  const candidatesRef = useRef<DropCandidate[]>([])
  const pendingPointRef = useRef<{ x: number, y: number } | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const dragging = drag !== null

  const cancelDrag = (preserveClickSuppression = false) => {
    previewRef.current = null
    setPreviewAst(null)
    setDrag(null)
    dragRef.current = null
    pendingDragRef.current = null
    activeDropKeyRef.current = null
    candidatesRef.current = []
    pendingPointRef.current = null
    if (animationFrameRef.current !== null)
      cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = null
    setActiveCandidate(null)
    if (!preserveClickSuppression)
      suppressClickRef.current = false
  }

  useEffect(() => {
    if (!dragging)
      return
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        cancelDrag()
    }
    const cancelForLayoutChange = () => cancelDrag()
    window.addEventListener('keydown', cancel)
    window.addEventListener('scroll', cancelForLayoutChange, true)
    window.addEventListener('resize', cancelForLayoutChange)
    return () => {
      window.removeEventListener('keydown', cancel)
      window.removeEventListener('scroll', cancelForLayoutChange, true)
      window.removeEventListener('resize', cancelForLayoutChange)
    }
  }, [dragging])

  useEffect(() => () => {
    if (animationFrameRef.current !== null)
      cancelAnimationFrame(animationFrameRef.current)
    pendingPointRef.current = null
  }, [])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (errorMsg || event.shiftKey || event.ctrlKey || (event.button !== 0 && event.button !== undefined))
      return
    const target = (event.target as Element).closest<SVGElement>('[data-drag-node-id]')
    const nodeId = target?.dataset.dragNodeId
    if (!nodeId)
      return
    const nodeIds = contiguousDragIds(ast, nodeId, selectedIds)
    pendingDragRef.current = {
      pointerId: event.pointerId,
      nodeIds,
      label: target.textContent?.trim() || `${nodeIds.length} node${nodeIds.length > 1 ? 's' : ''}`,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
    }
  }

  const updateDragAt = (activeDrag: DragState, point: { x: number, y: number }) => {
    setDrag(current => current && ({ ...current, x: point.x, y: point.y }))
    const candidate = chooseDropCandidate(
      candidatesRef.current,
      point,
      activeDropKeyRef.current,
    )
    if (!candidate) {
      previewRef.current = null
      setPreviewAst(null)
      activeDropKeyRef.current = null
      setActiveCandidate(null)
      return
    }
    if (candidate.key === activeDropKeyRef.current)
      return
    activeDropKeyRef.current = candidate.key
    setActiveCandidate(candidate)
    const next = moveNodes(ast, activeDrag.nodeIds, candidate.position)
    previewRef.current = next
    setPreviewAst(next)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    let activeDrag = dragRef.current
    const pending = pendingDragRef.current
    let started = false
    if (!activeDrag && pending && event.pointerId === pending.pointerId) {
      if (Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY) < 5)
        return
      activeDrag = pending
      dragRef.current = activeDrag
      pendingDragRef.current = null
      suppressClickRef.current = true
      event.currentTarget.setPointerCapture?.(event.pointerId)
      const nodeIds = activeDrag.nodeIds
      const candidates = Array.from(
        event.currentTarget.querySelectorAll<SVGElement>('[data-drop-key]'),
      ).flatMap((target) => {
        const position = readDropPosition(target)
        const key = target.dataset.dropKey
        if (!position || !key || !canMoveNodes(ast, nodeIds, position))
          return []
        const { left, right, top, bottom } = target.getBoundingClientRect()
        return [{ key, position, rect: { left, right, top, bottom } }]
      })
      candidatesRef.current = candidates
      setDrag(activeDrag)
      started = true
    }
    if (!activeDrag || event.pointerId !== activeDrag.pointerId)
      return
    const point = { x: event.clientX, y: event.clientY }
    if (started) {
      updateDragAt(activeDrag, point)
      return
    }
    pendingPointRef.current = point
    if (animationFrameRef.current === null) {
      animationFrameRef.current = requestAnimationFrame(() => {
        animationFrameRef.current = null
        const latestPoint = pendingPointRef.current
        const latestDrag = dragRef.current
        pendingPointRef.current = null
        if (latestPoint && latestDrag)
          updateDragAt(latestDrag, latestPoint)
      })
    }
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) {
      if (pendingDragRef.current && event.pointerId !== pendingDragRef.current.pointerId)
        return
      pendingDragRef.current = null
      return
    }
    if (event.pointerId !== dragRef.current.pointerId)
      return
    if (pendingPointRef.current)
      updateDragAt(dragRef.current, pendingPointRef.current)
    const next = previewRef.current
    cancelDrag(true)
    if (next)
      onMoveNodes(next)
  }

  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointerId = dragRef.current?.pointerId ?? pendingDragRef.current?.pointerId
    if (pointerId !== undefined && event.pointerId !== pointerId)
      return
    cancelDrag()
  }

  const [bindings, Selection] = useDragSelect({
    disabled: !!errorMsg,
    className: 'rounded bg-blue-500/50 border border-blue-500',
    onSelect: (box, mode) => selectNodesByBox(box, mode),
  })

  return (
    <div
      className="relative inline-block cursor-crosshair touch-none"
      {...bindings}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClickCapture={(event) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          event.preventDefault()
          event.stopPropagation()
        } else if (!event.shiftKey && !event.ctrlKey && !(event.target as Element).closest('[data-drag-node-id]')) {
          clearSelected()
        }
      }}
    >
      {errorMsg
        ? (
            <Alert>
              <ExclamationTriangleIcon className="h-6 w-6" />
              <AlertTitle className="!pl-10">{t('Graph unavailable')}</AlertTitle>
              <AlertDescription className="!pl-10">
                <p>{t('This syntax cannot be visualized. Use the Test tab to check it with the selected engine.')}</p>
                <p className="mt-2 font-mono text-xs break-words">{errorMsg}</p>
              </AlertDescription>
            </Alert>
          )
        : (
            <>
              {ast.body.length > 0 && (
                <ASTGraph ast={previewAst || ast} />
              )}
              {Selection}
            </>
          )}
      {drag && (
        <div
          data-testid="drag-ghost"
          className="fixed z-50 pointer-events-none rounded border border-blue-500 bg-graph-bg/90 px-2 py-1 font-mono text-sm shadow"
          style={{ left: drag.x + 12, top: drag.y + 12 }}
        >
          {drag.label}
        </div>
      )}
      {activeCandidate && (
        <div
          data-testid="active-drop-indicator"
          className={`fixed z-40 pointer-events-none rounded border ${activeCandidate.position.kind === 'insert' ? 'border-blue-500 bg-blue-500/60' : 'border-purple-500 bg-purple-500/30'}`}
          style={{
            left: activeCandidate.rect.left,
            top: activeCandidate.rect.top,
            width: activeCandidate.rect.right - activeCandidate.rect.left,
            height: activeCandidate.rect.bottom - activeCandidate.rect.top,
          }}
        >
          {activeCandidate.position.kind !== 'insert' && (
            <span className="px-2 text-[10px] text-purple-700 dark:text-purple-200">OR</span>
          )}
        </div>
      )}
    </div>
  )
}

export default Graph
