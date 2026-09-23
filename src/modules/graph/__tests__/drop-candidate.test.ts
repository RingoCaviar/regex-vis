import { describe, expect, it } from 'vitest'
import { chooseDropCandidate } from '../drop-candidate'

const candidates = [
  { key: 'left', position: {} as never, rect: { left: 0, right: 10, top: 0, bottom: 40 } },
  { key: 'right', position: {} as never, rect: { left: 30, right: 40, top: 0, bottom: 40 } },
]

describe('chooseDropCandidate', () => {
  it('shows only the nearest candidate', () => {
    expect(chooseDropCandidate(candidates, { x: 34, y: 20 }, null)?.key).toBe('right')
  })

  it('keeps the active candidate until another is clearly closer', () => {
    expect(chooseDropCandidate(candidates, { x: 21, y: 20 }, 'left')?.key).toBe('left')
    expect(chooseDropCandidate(candidates, { x: 32, y: 20 }, 'left')?.key).toBe('right')
  })

  it('hides candidates when the pointer is far away', () => {
    expect(chooseDropCandidate(candidates, { x: 200, y: 200 }, 'left')).toBeNull()
  })
})
