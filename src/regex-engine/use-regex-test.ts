import { useEffect, useMemo, useState } from 'react'
import type { MatchRequest, MatchResponse, RegexEngine } from './evaluate'
import { splitExpression } from './evaluate'

export function useRegexTest(engine: RegexEngine, input: string, flags: string, values: string[]) {
  const request = useMemo<MatchRequest>(() => ({
    engine,
    ...splitExpression(input, flags),
    values,
  }), [engine, input, flags, values])
  const [completed, setCompleted] = useState<{ request: MatchRequest, response: MatchResponse }>()

  useEffect(() => {
    let active = true
    let worker: Worker
    let timeout: ReturnType<typeof setTimeout>
    const finish = (response: MatchResponse) => {
      if (!active)
        return
      active = false
      clearTimeout(timeout)
      worker?.terminate()
      setCompleted({ request, response })
    }
    try {
      worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
      timeout = setTimeout(() => finish({ error: 'Engine loading timed out. Reload the page to retry.' }), 15000)
      worker.onmessage = (event: MessageEvent<MatchResponse & { ready?: boolean }>) => {
        if (event.data.ready) {
          clearTimeout(timeout)
          timeout = setTimeout(() => finish({ error: 'Matching timed out. Simplify the expression or shorten the test text.' }), 2000)
        } else {
          finish(event.data)
        }
      }
      worker.onerror = () => finish({ error: 'Unable to run the regex engine. Reload the page to retry.' })
      worker.postMessage(request)
      if (engine === 'javascript') {
        clearTimeout(timeout)
        timeout = setTimeout(() => finish({ error: 'Matching timed out. Simplify the expression or shorten the test text.' }), 2000)
      }
    } catch {
      finish({ error: 'Unable to run the regex engine. Reload the page to retry.' })
    }
    return () => {
      active = false
      clearTimeout(timeout)
      worker?.terminate()
    }
  }, [request, engine])

  return completed?.request === request ? completed.response : null
}
