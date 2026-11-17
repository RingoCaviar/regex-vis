import React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { isPrimaryGraphAtom, selectNodeAtom } from '@/atom'
import { GRAPH_NODE_BORDER_RADIUS } from '@/constants'
import { getSelectionMode } from '@/utils/selection'

type Props = {
  id: string
  selected: boolean
  draggable?: boolean
} & React.ComponentProps<'rect'>

function Content({ id, selected, draggable = selected, children, ...restProps }: Props) {
  const selectNode = useSetAtom(selectNodeAtom)
  const isPrimaryGraph = useAtomValue(isPrimaryGraphAtom)
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isPrimaryGraph) {
      selectNode(id, getSelectionMode(e))
    }
  }
  return (
    <g onClick={handleClick} data-drag-node-id={draggable ? id : undefined}>
      <rect
        {...restProps}
        className={`${restProps.className || ''} ${draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
        style={{ ...restProps.style, touchAction: 'none' }}
      />
      {selected && (
        <rect
          {...restProps}
          className="fill-blue-500/30 cursor-grab active:cursor-grabbing"
          rx={GRAPH_NODE_BORDER_RADIUS}
          ry={GRAPH_NODE_BORDER_RADIUS}
        >
        </rect>
      )}
      {children}
    </g>
  )
}

Content.displayName = 'Content'
export default Content
