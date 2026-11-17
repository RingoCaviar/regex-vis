import './vendor/wasm_exec.js'
import type { MatchRequest, MatchResponse } from './evaluate'

type GoRuntime = {
  importObject: WebAssembly.Imports
  run: (instance: WebAssembly.Instance) => Promise<void>
}

const runtime = globalThis as typeof globalThis & {
  Go: new () => GoRuntime
  regexVisMatch: (input: string) => string
}

let loading: Promise<void> | undefined

export function initializeMihomo(bytes: BufferSource) {
  loading ??= (async () => {
    const go = new runtime.Go()
    const { instance } = await WebAssembly.instantiate(bytes, go.importObject)
    // Go installs the synchronous bridge before its main goroutine waits.
    void go.run(instance)
  })()
  return loading
}

export function evaluateMihomo(request: MatchRequest): MatchResponse {
  return JSON.parse(runtime.regexVisMatch(JSON.stringify(request)))
}
