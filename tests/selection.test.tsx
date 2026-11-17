import { fireEvent, getByText, render, screen } from '@testing-library/react'
import { act } from 'react'
import { Provider } from 'jotai'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../src/App'

beforeEach(() => {
  vi.useFakeTimers()
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

async function renderGraph(regex = 'a\\db') {
  render(<Provider><App /></Provider>)
  await act(async () => {
    fireEvent.change(screen.getByTestId('regex-input'), { target: { value: regex } })
    vi.advanceTimersByTime(500)
  })
  const graph = screen.getAllByTestId('graph')[0]
  const node = (label: string) => getByText(graph, label).closest('g')!
  const selected = () => Array.from(graph.querySelectorAll('.fill-blue-500\\/30'))
    .map(rect => rect.parentElement!.textContent!.replaceAll('"', ''))
  return { graph, wrapper: graph.parentElement!, node, selected }
}

it('adds clicked nodes with Shift without selecting intervening nodes or toggling existing ones', async () => {
  const { node, selected } = await renderGraph()
  fireEvent.click(node('b'))
  fireEvent.click(node('a'), { shiftKey: true })
  expect(selected()).toEqual(['a', 'b'])
  fireEvent.click(node('a'), { shiftKey: true })
  expect(selected()).toEqual(['a', 'b'])
})

it('subtracts only clicked nodes with Ctrl and gives Ctrl priority over Shift', async () => {
  const { node, selected, wrapper } = await renderGraph()
  fireEvent.click(node('a'))
  fireEvent.click(node('b'), { shiftKey: true })
  fireEvent.click(node('a'), { ctrlKey: true, shiftKey: true })
  expect(selected()).toEqual(['b'])
  fireEvent.click(node('a'), { ctrlKey: true })
  fireEvent.click(wrapper, { shiftKey: true })
  fireEvent.click(wrapper, { ctrlKey: true })
  expect(selected()).toEqual(['b'])
  fireEvent.click(node('b'), { ctrlKey: true })
  expect(selected()).toEqual([])
})

function boxSelect(wrapper: HTMLElement, node: Element, modifiers: MouseEventInit = {}) {
  const rect = node.querySelector('rect')!
  const x = Number(rect.getAttribute('x'))
  const y = Number(rect.getAttribute('y'))
  const width = Number(rect.getAttribute('width'))
  const height = Number(rect.getAttribute('height'))
  fireEvent.pointerDown(wrapper, { pointerId: 9, button: 0, clientX: x - 1, clientY: y - 1, ...modifiers })
  fireEvent.pointerMove(wrapper, { pointerId: 9, clientX: x + width + 1, clientY: y + height + 1, ...modifiers })
  fireEvent.pointerUp(wrapper, { pointerId: 9, ...modifiers })
  fireEvent.click(wrapper, modifiers)
}

it('adds and subtracts boxed nodes while preserving nodes outside the box', async () => {
  const { node, selected, wrapper } = await renderGraph()
  fireEvent.click(node('a'))
  boxSelect(wrapper, node('b'), { shiftKey: true })
  expect(selected()).toEqual(['a', 'b'])
  boxSelect(wrapper, node('a'), { ctrlKey: true })
  expect(selected()).toEqual(['b'])
  boxSelect(wrapper, node('a'), { ctrlKey: true })
  expect(selected()).toEqual(['b'])
  boxSelect(wrapper, node('a'))
  expect(selected()).toEqual(['a'])
})

it('deletes a non-contiguous selection without deleting the intervening node', async () => {
  const { node } = await renderGraph()
  fireEvent.click(node('a'))
  fireEvent.click(node('b'), { shiftKey: true })
  expect(screen.getByTestId('edit-tab')).toHaveTextContent('Select consecutive nodes')
  expect(screen.queryByRole('button', { name: 'Capturing' })).not.toBeInTheDocument()
  fireEvent.keyDown(document.body, { key: 'Delete' })
  await act(async () => {
    vi.advanceTimersByTime(500)
  })
  expect(screen.getByTestId('regex-input')).toHaveValue('\\d')
  fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
  await act(async () => {
    vi.advanceTimersByTime(500)
  })
  expect(screen.getByTestId('regex-input')).toHaveValue('a\\db')
})

it('subtracts a middle node without shifting the remaining highlights', async () => {
  const { node, selected } = await renderGraph('a+b+c+')
  fireEvent.click(node('a'))
  fireEvent.click(node('b'), { shiftKey: true })
  fireEvent.click(node('c'), { shiftKey: true })
  fireEvent.click(node('b'), { ctrlKey: true })
  expect(selected()).toEqual(['a', 'c'])
  fireEvent.keyDown(document.body, { key: 'Delete' })
  await act(async () => {
    vi.advanceTimersByTime(500)
  })
  expect(screen.getByTestId('regex-input')).toHaveValue('b+')
})

it('keeps combined edits in expression order after adding nodes right to left', async () => {
  const { node } = await renderGraph('a+b+')
  fireEvent.click(node('b'))
  fireEvent.click(node('a'), { shiftKey: true })
  fireEvent.click(screen.getByRole('button', { name: 'Capturing' }))
  await act(async () => {
    vi.advanceTimersByTime(500)
  })
  expect(screen.getByTestId('regex-input')).toHaveValue('(a+b+)')
})

it('selects across branches and deletes only the selected nodes', async () => {
  const { node, selected } = await renderGraph('(a+x|b+y)z')
  fireEvent.click(node('a'))
  fireEvent.click(node('b'), { shiftKey: true })
  expect(selected()).toEqual(['a', 'b'])
  fireEvent.keyDown(document.body, { key: 'Delete' })
  await act(async () => {
    vi.advanceTimersByTime(500)
  })
  expect(screen.getByTestId('regex-input')).toHaveValue('(x|y)z')
})

it('preserves ordinary click selection, toggling and clearing', async () => {
  const { node, selected, wrapper } = await renderGraph()
  fireEvent.click(node('a'))
  fireEvent.click(node('b'), { shiftKey: true })
  fireEvent.click(node('a'))
  expect(selected()).toEqual(['a'])
  fireEvent.click(node('a'))
  expect(selected()).toEqual([])
  fireEvent.click(node('b'))
  fireEvent.click(wrapper)
  expect(selected()).toEqual([])
})

it.each([{ shiftKey: true }, { ctrlKey: true }])('uses modified drags for selection rather than moving nodes: %j', async (modifiers) => {
  const { node, wrapper } = await renderGraph()
  fireEvent.click(node('a'))
  fireEvent.pointerDown(node('a'), { pointerId: 1, button: 0, clientX: 10, clientY: 10, ...modifiers })
  fireEvent.pointerMove(wrapper, { pointerId: 1, clientX: 100, clientY: 100, ...modifiers })
  expect(screen.queryByTestId('drag-ghost')).not.toBeInTheDocument()
  expect(screen.getByTestId('selection-box')).toBeInTheDocument()
  fireEvent.pointerUp(wrapper, { pointerId: 1, ...modifiers })
  fireEvent.click(wrapper, modifiers)
  expect(screen.getByTestId('regex-input')).toHaveValue('a\\db')
})

it('cancels a modified box selection without changing the selection', async () => {
  const { node, selected, wrapper } = await renderGraph()
  fireEvent.click(node('a'))
  fireEvent.pointerDown(wrapper, { pointerId: 1, button: 0, clientX: 0, clientY: 0, ctrlKey: true })
  fireEvent.pointerMove(wrapper, { pointerId: 1, clientX: 1000, clientY: 1000, ctrlKey: true })
  fireEvent.pointerCancel(wrapper, { pointerId: 1 })
  expect(screen.queryByTestId('selection-box')).not.toBeInTheDocument()
  expect(selected()).toEqual(['a'])
  fireEvent.click(node('b'), { shiftKey: true })
  expect(selected()).toEqual(['a', 'b'])
})

it('drags the pressed node when the selection spans separate branches', async () => {
  const { graph, node, wrapper } = await renderGraph('(a|b)c')
  fireEvent.click(node('a'))
  fireEvent.click(node('b'), { shiftKey: true })
  const target = graph.querySelector('[data-drop-index="2"]')!
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
    x: 290,
    y: 0,
    left: 290,
    top: 0,
    right: 310,
    bottom: 40,
    width: 20,
    height: 40,
    toJSON: () => ({}),
  })
  fireEvent.pointerDown(node('b'), { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
  fireEvent.pointerMove(wrapper, { pointerId: 1, clientX: 300, clientY: 10 })
  fireEvent.pointerUp(wrapper, { pointerId: 1 })
  fireEvent.click(wrapper)
  await act(async () => {
    vi.advanceTimersByTime(500)
  })
  expect(screen.getByTestId('regex-input')).toHaveValue('(a)cb')
})

it('adds a fully boxed group as one node without also selecting its children', async () => {
  const { graph, wrapper } = await renderGraph('(a)')
  const group = graph.querySelector('.stroke-graph-group')!.parentElement!
  boxSelect(wrapper, group, { shiftKey: true })
  expect(graph.querySelectorAll('.fill-blue-500\\/30')).toHaveLength(1)
  expect(screen.getByTestId('edit-tab')).not.toHaveTextContent('Select consecutive nodes')
})
