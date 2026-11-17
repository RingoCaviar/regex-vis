import { evaluateJavaScript } from './evaluate'
import type { MatchRequest } from './evaluate'

globalThis.onmessage = async (event: MessageEvent<MatchRequest>) => {
  try {
    if (event.data.engine === 'javascript') {
      globalThis.postMessage(evaluateJavaScript(event.data))
      return
    }
    const { initializeMihomo, evaluateMihomo } = await import('./mihomo')
    const response = await fetch(new URL('./regexp2.wasm', import.meta.url))
    if (!response.ok)
      throw new Error('Unable to load the Mihomo engine. Reload the page to retry.')
    await initializeMihomo(await response.arrayBuffer())
    globalThis.postMessage({ ready: true })
    globalThis.postMessage(evaluateMihomo(event.data))
  } catch (error) {
    globalThis.postMessage({ error: error instanceof Error ? error.message : String(error) })
  }
}
