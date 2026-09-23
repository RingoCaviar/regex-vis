import { fireEvent, getByText, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/dom'
import App from '../src/App'

function mockDropRect(element: Element, left: number, top: number, width = 20, height = 20) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  })
}

describe('app', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders graph after inputting', async () => {
    render(<App />)
    expect(screen.getAllByTestId('graph').length).toBe(13)

    await act(async () => {
      const input = screen.getAllByTestId('regex-input')[0]
      fireEvent.change(input, { target: { value: 'abc' } })
      vi.advanceTimersByTime(500)
    })

    expect(screen.getAllByTestId('graph').length).toBe(14)
  })

  it('updates graph after editing', async () => {
    render(<App />)

    await act(async () => {
      const input = screen.getByTestId('regex-input')
      fireEvent.change(input, { target: { value: 'abc' } })
      vi.advanceTimersByTime(500)

      fireEvent.click(getByText(screen.getAllByTestId('graph')[0], 'abc'), {
        bubbles: true,
      })
    })

    await act(async () => {
      const input = screen
        .getByTestId('edit-tab')
        .querySelector('input[type=\'text\']')
      fireEvent.change(input!, { target: { value: 'abcd' } })
      vi.advanceTimersByTime(500)
    })

    expect((screen.getByTestId('regex-input') as HTMLInputElement).value).toBe(
      'abcd',
    )
    expect(
      getByText(screen.getAllByTestId('graph')[0], 'abcd'),
    ).toBeInTheDocument()
  })

  it('updates the expression after dropping a graph node at a new position', async () => {
    render(<App />)

    await act(async () => {
      fireEvent.change(screen.getByTestId('regex-input'), {
        target: { value: 'a\\db' },
      })
      vi.advanceTimersByTime(500)
    })

    const graph = screen.getAllByTestId('graph')[0]
    const wrapper = graph.parentElement!
    const source = getByText(graph, 'a').closest('g')!.querySelector('rect')!
    const dropPosition = graph.querySelector(
      '[data-drop-index="3"]',
    )!
    mockDropRect(dropPosition, 90, 0, 20, 40)
    fireEvent.click(source)

    await act(async () => {
      fireEvent.pointerDown(source, {
        pointerId: 1,
        button: 0,
        clientX: 10,
        clientY: 10,
      })
      fireEvent.pointerMove(wrapper, {
        pointerId: 1,
        clientX: 100,
        clientY: 10,
      })
    })
    expect(screen.getByTestId('drag-ghost')).toBeInTheDocument()

    await act(async () => {
      fireEvent.pointerUp(wrapper, { pointerId: 1 })
      vi.advanceTimersByTime(500)
    })

    expect((screen.getByTestId('regex-input') as HTMLInputElement).value)
      .toBe('\\dba')
  })

  it('keeps click-to-select working without starting a drag', async () => {
    render(<App />)
    await act(async () => {
      fireEvent.change(screen.getByTestId('regex-input'), { target: { value: 'a\\d' } })
      vi.advanceTimersByTime(500)
    })

    const graph = screen.getAllByTestId('graph')[0]
    const node = getByText(graph, 'a').closest('g')!.querySelector('rect')!
    fireEvent.pointerDown(node, { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
    expect(screen.queryByTestId('drag-ghost')).not.toBeInTheDocument()
    fireEvent.pointerUp(node, { pointerId: 1, clientX: 10, clientY: 10 })
    fireEvent.click(node)

    expect(node.parentElement!.querySelector('.fill-blue-500\\/30')).toBeInTheDocument()
  })

  it('starts dragging directly from an unselected node', async () => {
    render(<App />)
    await act(async () => {
      fireEvent.change(screen.getByTestId('regex-input'), { target: { value: 'a\\d' } })
      vi.advanceTimersByTime(500)
    })

    const graph = screen.getAllByTestId('graph')[0]
    const wrapper = graph.parentElement!
    const node = getByText(graph, 'a').closest('g')!.querySelector('rect')!
    mockDropRect(wrapper, 100, 100, 300, 200)

    fireEvent.pointerDown(node, { pointerId: 1, button: 0, clientX: 110, clientY: 110 })
    fireEvent.pointerMove(wrapper, { pointerId: 1, clientX: 135, clientY: 135 })

    expect(screen.getByTestId('drag-ghost')).toBeInTheDocument()
    expect(screen.queryByTestId('selection-box')).not.toBeInTheDocument()
    fireEvent.pointerUp(window, { pointerId: 1 })
    fireEvent.click(wrapper)
  })

  it('shows only the active drop position while dragging a node', async () => {
    render(<App />)
    await act(async () => {
      fireEvent.change(screen.getByTestId('regex-input'), { target: { value: 'a\\d' } })
      vi.advanceTimersByTime(500)
    })

    const graph = screen.getAllByTestId('graph')[0]
    const node = getByText(graph, 'a').closest('g')!.querySelector('rect')!
    expect(graph.querySelector('[data-drop-kind="insert"]')).toHaveAttribute('opacity', '0')
    fireEvent.click(node)

    fireEvent.pointerDown(node, { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
    await act(async () => {
      fireEvent.pointerMove(graph.parentElement!, { pointerId: 1, clientX: 30, clientY: 30 })
    })
    expect(screen.getAllByTestId('active-drop-indicator')).toHaveLength(1)
  })

  it.each(['mouse', 'touch', 'pen'])('starts box selection with a %s pointer', async (pointerType) => {
    render(<App />)
    await act(async () => {
      fireEvent.change(screen.getByTestId('regex-input'), { target: { value: 'a\\d' } })
      vi.advanceTimersByTime(500)
    })

    const graph = screen.getAllByTestId('graph')[0]
    const besideNode = graph.querySelector('[data-drop-kind="insert"]')!
    expect(besideNode).toHaveAttribute('pointer-events', 'none')
    const wrapper = graph.parentElement!
    expect(graph.closest('div.cursor-crosshair')).toHaveClass('touch-none')
    fireEvent.pointerDown(wrapper, { pointerId: 7, pointerType, button: 0, clientX: 1, clientY: 1 })
    fireEvent.pointerMove(wrapper, { pointerId: 7, pointerType, clientX: 30, clientY: 30 })

    expect(screen.getByTestId('selection-box')).toBeInTheDocument()
    fireEvent.pointerUp(wrapper, { pointerId: 7, pointerType })
    fireEvent.click(wrapper)
  })

  it('starts box selection from blank space inside an unselected group', async () => {
    render(<App />)
    await act(async () => {
      fireEvent.change(screen.getByTestId('regex-input'), { target: { value: '(a)' } })
      vi.advanceTimersByTime(500)
    })

    const graph = screen.getAllByTestId('graph')[0]
    const groupBorder = graph.querySelector<SVGRectElement>('.stroke-graph-group')!
    expect(groupBorder.parentElement).not.toHaveAttribute('data-drag-node-id')
    expect(groupBorder).not.toHaveAttribute('data-drag-node-id')
    expect(groupBorder).toHaveAttribute('pointer-events', 'all')
    expect(groupBorder).not.toHaveClass('cursor-grab')
    expect(groupBorder).toHaveClass('cursor-crosshair')

    fireEvent.pointerDown(groupBorder, { pointerId: 1, button: 0, clientX: 20, clientY: 20 })
    fireEvent.pointerMove(graph.parentElement!, { pointerId: 1, clientX: 40, clientY: 40 })

    expect(screen.getByTestId('selection-box')).toBeInTheDocument()
    fireEvent.pointerUp(window, { pointerId: 1 })
    fireEvent.click(groupBorder)
    expect(graph.querySelector('.fill-blue-500\\/30')).not.toBeInTheDocument()
  })

  it('selects an unselected group by clicking its interior', async () => {
    render(<App />)
    await act(async () => {
      fireEvent.change(screen.getByTestId('regex-input'), { target: { value: '(a)' } })
      vi.advanceTimersByTime(500)
    })

    const graph = screen.getAllByTestId('graph')[0]
    const groupBorder = graph.querySelector<SVGRectElement>('.stroke-graph-group')!
    await act(async () => {
      fireEvent.click(groupBorder)
    })

    expect(graph.querySelector('.fill-blue-500\\/30')).toHaveClass('cursor-grab')
  })

  it('does not turn a horizontal group-interior drag into a click', async () => {
    render(<App />)
    await act(async () => {
      fireEvent.change(screen.getByTestId('regex-input'), { target: { value: '(a)' } })
      vi.advanceTimersByTime(500)
    })

    const graph = screen.getAllByTestId('graph')[0]
    const groupBorder = graph.querySelector<SVGRectElement>('.stroke-graph-group')!
    fireEvent.pointerDown(groupBorder, { pointerId: 1, button: 0, clientX: 20, clientY: 20 })
    fireEvent.pointerMove(graph.parentElement!, { pointerId: 1, clientX: 50, clientY: 20 })
    fireEvent.pointerUp(window, { pointerId: 1 })
    fireEvent.click(groupBorder)

    expect(graph.querySelector('.fill-blue-500\\/30')).not.toBeInTheDocument()
  })

  it('clears the selection when clicking the outer blank canvas', async () => {
    render(<App />)
    await act(async () => {
      fireEvent.change(screen.getByTestId('regex-input'), { target: { value: 'a\\d' } })
      vi.advanceTimersByTime(500)
    })

    const graph = screen.getAllByTestId('graph')[0]
    const node = getByText(graph, 'a').closest('g')!
    await act(async () => {
      fireEvent.click(node)
    })
    expect(graph.querySelector('.fill-blue-500\\/30')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(graph)
    })

    expect(graph.querySelector('.fill-blue-500\\/30')).not.toBeInTheDocument()
  })

  it('drags a selected group from its interior', async () => {
    render(<App />)
    await act(async () => {
      fireEvent.change(screen.getByTestId('regex-input'), { target: { value: '(a)\\d' } })
      vi.advanceTimersByTime(500)
    })

    const graph = screen.getAllByTestId('graph')[0]
    const groupBorder = graph.querySelector<SVGRectElement>('.stroke-graph-group')!
    await act(async () => {
      fireEvent.click(groupBorder)
    })

    const selectedGroupBorder = graph.querySelector<SVGRectElement>('.stroke-graph-group')!
    expect(selectedGroupBorder).toHaveAttribute('pointer-events', 'all')
    expect(selectedGroupBorder.parentElement).toHaveAttribute('data-drag-node-id')
    expect(selectedGroupBorder).toHaveClass('cursor-grab')

    fireEvent.pointerDown(selectedGroupBorder, {
      pointerId: 1,
      button: 0,
      clientX: 20,
      clientY: 20,
    })
    fireEvent.pointerMove(graph.parentElement!, {
      pointerId: 1,
      clientX: 40,
      clientY: 40,
    })

    expect(screen.getByTestId('drag-ghost')).toBeInTheDocument()
    fireEvent.pointerCancel(graph.parentElement!, { pointerId: 1 })
  })

  it('creates an OR branch by dropping above a node sequence', async () => {
    render(<App />)
    await act(async () => {
      fireEvent.change(screen.getByTestId('regex-input'), { target: { value: 'a\\db' } })
      vi.advanceTimersByTime(500)
    })

    const graph = screen.getAllByTestId('graph')[0]
    const wrapper = graph.parentElement!
    const source = getByText(graph, 'b').closest('g')!.querySelector('rect')!
    const orPosition = graph.querySelector('[data-drop-kind="branch-before"]')!
    mockDropRect(orPosition, 20, 20)
    fireEvent.click(source)

    fireEvent.pointerDown(source, { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
    await act(async () => {
      fireEvent.pointerMove(wrapper, { pointerId: 1, clientX: 30, clientY: 30 })
    })
    fireEvent.pointerUp(wrapper, { pointerId: 1, clientX: 30, clientY: 30 })

    expect((screen.getByTestId('regex-input') as HTMLInputElement).value)
      .toBe('b|a\\d')
  })

  it('keeps the drop candidate stable when preview reflow moves its markers', async () => {
    render(<App />)
    await act(async () => {
      fireEvent.change(screen.getByTestId('regex-input'), { target: { value: 'a\\db' } })
      vi.advanceTimersByTime(500)
    })

    const graph = screen.getAllByTestId('graph')[0]
    const wrapper = graph.parentElement!
    const source = getByText(graph, 'a').closest('g')!.querySelector('rect')!
    mockDropRect(graph.querySelector('[data-drop-index="3"]')!, 90, 0, 20, 40)

    fireEvent.pointerDown(source, { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
    await act(async () => {
      fireEvent.pointerMove(wrapper, { pointerId: 1, clientX: 100, clientY: 10 })
    })
    expect(screen.getByTestId('active-drop-indicator')).toHaveStyle({ left: '90px', top: '0px' })

    for (const marker of Array.from(screen.getAllByTestId('graph')[0].querySelectorAll('[data-drop-key]')))
      mockDropRect(marker, 500, 500)
    await act(async () => {
      fireEvent.pointerMove(wrapper, { pointerId: 1, clientX: 100, clientY: 10 })
    })

    expect(screen.getByTestId('active-drop-indicator')).toHaveStyle({ left: '90px', top: '0px' })
  })

  it('coalesces rapid pointer moves to the latest position in one frame', async () => {
    render(<App />)
    await act(async () => {
      fireEvent.change(screen.getByTestId('regex-input'), { target: { value: 'a\\d' } })
      vi.advanceTimersByTime(500)
    })
    const graph = screen.getAllByTestId('graph')[0]
    const wrapper = graph.parentElement!
    const node = getByText(graph, 'a').closest('g')!.querySelector('rect')!

    fireEvent.pointerDown(node, { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
    await act(async () => {
      fireEvent.pointerMove(wrapper, { pointerId: 1, clientX: 30, clientY: 30 })
    })
    expect(screen.getByTestId('drag-ghost')).toHaveStyle({ left: '42px', top: '42px' })

    fireEvent.pointerMove(wrapper, { pointerId: 1, clientX: 40, clientY: 40 })
    fireEvent.pointerMove(wrapper, { pointerId: 1, clientX: 50, clientY: 50 })
    expect(screen.getByTestId('drag-ghost')).toHaveStyle({ left: '42px', top: '42px' })

    await act(async () => vi.advanceTimersByTime(16))
    expect(screen.getByTestId('drag-ghost')).toHaveStyle({ left: '62px', top: '62px' })
  })

  it('cancels a drag when scrolling invalidates frozen drop positions', async () => {
    render(<App />)
    await act(async () => {
      fireEvent.change(screen.getByTestId('regex-input'), { target: { value: 'a\\d' } })
      vi.advanceTimersByTime(500)
    })
    const graph = screen.getAllByTestId('graph')[0]
    const wrapper = graph.parentElement!
    const node = getByText(graph, 'a').closest('g')!.querySelector('rect')!

    fireEvent.pointerDown(node, { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
    await act(async () => {
      fireEvent.pointerMove(wrapper, { pointerId: 1, clientX: 30, clientY: 30 })
    })
    expect(screen.getByTestId('drag-ghost')).toBeInTheDocument()

    await act(async () => fireEvent.scroll(window))

    expect(screen.queryByTestId('drag-ghost')).not.toBeInTheDocument()
    expect(screen.queryByTestId('active-drop-indicator')).not.toBeInTheDocument()
  })

  it('ignores pointer lifecycle events from another pointer', async () => {
    render(<App />)
    await act(async () => {
      fireEvent.change(screen.getByTestId('regex-input'), { target: { value: 'a\\d' } })
      vi.advanceTimersByTime(500)
    })
    const graph = screen.getAllByTestId('graph')[0]
    const wrapper = graph.parentElement!
    const node = getByText(graph, 'a').closest('g')!.querySelector('rect')!

    fireEvent.pointerDown(node, { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerUp(wrapper, { pointerId: 2 })
    await act(async () => {
      fireEvent.pointerMove(wrapper, { pointerId: 1, clientX: 30, clientY: 30 })
    })
    expect(screen.getByTestId('drag-ghost')).toBeInTheDocument()

    fireEvent.pointerCancel(wrapper, { pointerId: 2 })
    expect(screen.getByTestId('drag-ghost')).toBeInTheDocument()
  })

  it('can start dragging from visible node text', async () => {
    render(<App />)
    await act(async () => {
      fireEvent.change(screen.getByTestId('regex-input'), { target: { value: 'a\\d' } })
      vi.advanceTimersByTime(500)
    })
    const graph = screen.getAllByTestId('graph')[0]
    const label = getByText(graph, 'a')
    fireEvent.click(label)
    fireEvent.pointerDown(label, { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
    fireEvent.pointerMove(graph.parentElement!, { pointerId: 1, clientX: 30, clientY: 30 })
    expect(screen.getByTestId('drag-ghost')).toBeInTheDocument()
  })

  it('does not consume the next selection click after Escape cancels a drag', async () => {
    render(<App />)
    await act(async () => {
      fireEvent.change(screen.getByTestId('regex-input'), { target: { value: 'a\\d' } })
      vi.advanceTimersByTime(500)
    })
    const graph = screen.getAllByTestId('graph')[0]
    const nodeGroup = getByText(graph, 'a').closest('g')!
    fireEvent.click(nodeGroup)
    await act(async () => {
      fireEvent.pointerDown(nodeGroup, { pointerId: 1, button: 0, clientX: 10, clientY: 10 })
      fireEvent.pointerMove(graph.parentElement!, { pointerId: 1, clientX: 30, clientY: 30 })
    })
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(screen.queryByTestId('drag-ghost')).not.toBeInTheDocument()
    const currentNodeGroup = getByText(screen.getAllByTestId('graph')[0], 'a').closest('g')!
    await act(async () => {
      fireEvent.click(currentNodeGroup)
    })

    expect(screen.getAllByTestId('graph')[0].querySelector('.fill-blue-500\\/30')).not.toBeInTheDocument()
  })
})
