import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import process from 'node:process'

const root = fileURLToPath(new URL('../', import.meta.url))
const go = process.env.GO_BINARY || 'go'
const cwd = path.join(root, 'engines/regexp2')
const output = path.join(root, 'src/regex-engine')
mkdirSync(path.join(output, 'vendor'), { recursive: true })
execFileSync(go, ['mod', 'download', 'all'], { cwd, stdio: 'inherit' })
execFileSync(go, ['build', '-trimpath', '-ldflags=-s -w', '-o', path.join(output, 'regexp2.wasm'), '.'], {
  cwd,
  env: { ...process.env, GOOS: 'js', GOARCH: 'wasm' },
  stdio: 'inherit',
})
const goRoot = execFileSync(go, ['env', 'GOROOT'], { encoding: 'utf8' }).trim()
copyFileSync(path.join(goRoot, 'lib/wasm/wasm_exec.js'), path.join(output, 'vendor/wasm_exec.js'))
copyFileSync(path.join(goRoot, 'LICENSE'), path.join(output, 'vendor/GO-LICENSE'))
const module = JSON.parse(execFileSync(go, ['list', '-m', '-json', 'github.com/dlclark/regexp2'], { cwd, encoding: 'utf8' }))
copyFileSync(path.join(module.Dir, 'LICENSE'), path.join(output, 'vendor/REGEXP2-LICENSE'))
