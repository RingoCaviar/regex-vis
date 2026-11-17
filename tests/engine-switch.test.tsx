import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Provider } from 'jotai'
import App from '../src/App'
import { genPermalink } from '../src/utils/helpers'
import TestTab from '../src/modules/editor/test-tab'
import type { MatchRequest, MatchResponse } from '../src/regex-engine/evaluate'
import { evaluateJavaScript } from '../src/regex-engine/evaluate'
import { evaluateMihomo, initializeMihomo } from '../src/regex-engine/mihomo'

const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')

// jsdom has no Worker. Keep both real engines behind this transport adapter;
// the bundled browser worker is also exercised in browser verification.
class EngineWorker {
  onmessage: ((event: MessageEvent<MatchResponse>) => void) | null = null
  stopped = false
  postMessage(request: MatchRequest) {
    queueMicrotask(() => {
      if (!this.stopped) {
        const result = request.engine === 'mihomo' ? evaluateMihomo(request) : evaluateJavaScript(request)
        this.onmessage?.(new MessageEvent('message', { data: result }))
      }
    })
  }

  terminate() {
    this.stopped = true
  }
}

beforeAll(async () => {
  await initializeMihomo(await readFile(path.resolve('src/regex-engine/regexp2.wasm')))
})

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('test-cases', JSON.stringify(['[ziyong2] 美国111']))
  vi.stubGlobal('Worker', EngineWorker)
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
})

afterEach(() => {
  vi.unstubAllGlobals()
  if (originalScrollIntoView)
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView)
  else
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})

it('recalculates on engine changes, remembers the choice and preserves test text', async () => {
  const view = render(
    <MemoryRouter>
      <TestTab regex={String.raw`美国\b`} flags="" graphError={null} />
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/^Matches$/))
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Matching engine' }), { key: 'ArrowDown' })
  fireEvent.keyDown(await screen.findByRole('option', { name: 'Clash Verge (Mihomo)' }), { key: 'Enter' })
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/^No match$/))
  expect(screen.getByRole('textbox', { name: 'Test text' })).toHaveValue('[ziyong2] 美国111')
  expect(JSON.parse(localStorage.getItem('regex-engine')!)).toBe('mihomo')
  view.unmount()
  render(<MemoryRouter><TestTab regex={String.raw`美国\b`} flags="" graphError={null} /></MemoryRouter>)
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/^No match$/))
  expect(screen.getByRole('combobox')).toHaveTextContent('Clash Verge (Mihomo)')
})

it('tests the raw input when the graph parser cannot display it and reports engine errors', async () => {
  const view = render(
    <MemoryRouter initialEntries={['/?engine=mihomo']}>
      <TestTab regex="(?i)美国" flags="" graphError="Unsupported graph syntax" />
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/^Matches$/))
  expect(screen.getByText(/The graph cannot display this syntax/)).toBeInTheDocument()
  view.rerender(
    <MemoryRouter initialEntries={['/?engine=mihomo']}>
      <TestTab regex="[" flags="" graphError="Invalid pattern" />
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Unable to test'))
  expect(screen.getByRole('alert')).not.toBeEmptyDOMElement()
})

it('honors a shared JavaScript engine link over the saved Mihomo preference', async () => {
  localStorage.setItem('regex-engine', JSON.stringify('mihomo'))
  render(
    <MemoryRouter initialEntries={['/?engine=javascript']}>
      <TestTab regex={String.raw`美国\b`} flags="" graphError={null} />
    </MemoryRouter>,
  )
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/^Matches$/))
  expect(screen.getByRole('combobox')).toHaveTextContent('Default (JavaScript)')
})

it.each(['(?m)^us$', '/(?m)^us$/'])('keeps flags effective and shareable for graph-unsupported input: %s', async (regex) => {
  window.history.replaceState(null, '', `/?r=${encodeURIComponent(regex)}&engine=mihomo&t=${encodeURIComponent(JSON.stringify(['US']))}`)
  const view = render(<Provider><App /></Provider>)
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/^No match$/))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Case-insensitive' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/^Matches$/))
  expect(screen.getByTestId('regex-input')).toHaveValue('/(?m)^us$/i')
  const link = genPermalink(['US'])
  view.unmount()
  localStorage.clear()
  window.history.replaceState(null, '', link)
  render(<Provider><App /></Provider>)
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/^Matches$/))
  expect(screen.getByRole('checkbox', { name: 'Case-insensitive' })).toBeChecked()
})

it('includes external flags in copied test links for plain expressions', () => {
  window.history.replaceState(null, '', '/?r=us&engine=mihomo')
  const link = new URL(genPermalink(['US'], 'i'))
  expect(link.searchParams.get('r')).toBe('/us/i')
  expect(link.searchParams.get('engine')).toBe('mihomo')
  expect(link.searchParams.get('t')).toBe('["US"]')
})
