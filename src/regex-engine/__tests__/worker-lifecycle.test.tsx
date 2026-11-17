import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useRegexTest } from '../use-regex-test'
import type { MatchResponse, RegexEngine } from '../evaluate'

class PendingWorker {
  static instances: PendingWorker[] = []
  onmessage: ((event: MessageEvent<MatchResponse>) => void) | null = null
  terminate = vi.fn()
  postMessage = vi.fn()
  constructor() {
    PendingWorker.instances.push(this)
  }

  reply(response: MatchResponse) {
    this.onmessage?.(new MessageEvent('message', { data: response }))
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  PendingWorker.instances = []
  vi.stubGlobal('Worker', PendingWorker)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('discards a late response after switching engines', () => {
  const values = ['美国111']
  const { result, rerender } = renderHook(({ engine }: { engine: RegexEngine }) =>
    useRegexTest(engine, String.raw`美国\b`, '', values), { initialProps: { engine: 'javascript' } })
  const first = PendingWorker.instances[0]
  rerender({ engine: 'mihomo' })
  const second = PendingWorker.instances[1]
  expect(first.terminate).toHaveBeenCalled()
  act(() => second.reply({ results: [false] }))
  act(() => first.reply({ results: [true] }))
  expect(result.current).toEqual({ results: [false] })
})

it('stops a stalled match and reports an error instead of a non-match', () => {
  const values = ['aaaa!']
  const { result } = renderHook(() => useRegexTest('javascript', '(a+)+$', '', values))
  expect(result.current).toBeNull()
  act(() => vi.advanceTimersByTime(2000))
  expect(PendingWorker.instances[0].terminate).toHaveBeenCalled()
  expect(result.current?.error).toContain('Matching timed out')
  expect(result.current?.results).toBeUndefined()
})
