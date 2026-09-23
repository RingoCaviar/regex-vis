import type { DropPosition } from '@/parser'

type Point = { x: number, y: number }
type Rect = { left: number, right: number, top: number, bottom: number }

export type DropCandidate = {
  key: string
  position: DropPosition
  rect: Rect
}

function distanceToRect(point: Point, rect: Rect) {
  const dx = Math.max(rect.left - point.x, 0, point.x - rect.right)
  const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom)
  return Math.hypot(dx, dy)
}

export function chooseDropCandidate(
  candidates: DropCandidate[],
  point: Point,
  activeKey: string | null,
  maxDistance = 48,
  switchMargin = 12,
): DropCandidate | null {
  let nearest: { candidate: DropCandidate, distance: number } | undefined
  let active: { candidate: DropCandidate, distance: number } | undefined
  for (const candidate of candidates) {
    const item = { candidate, distance: distanceToRect(point, candidate.rect) }
    if (!nearest || item.distance < nearest.distance)
      nearest = item
    if (candidate.key === activeKey)
      active = item
  }
  if (!nearest || nearest.distance > maxDistance)
    return null

  if (active && active.distance <= maxDistance && active.distance <= nearest.distance + switchMargin)
    return active.candidate
  return nearest.candidate
}
