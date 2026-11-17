import type { ReactNode } from 'react'
import React, { useEffect, useMemo } from 'react'
import { useAtomValue } from 'jotai'
import ChoiceNode from './choice'
import SimpleNode from './simple-node'
import GroupLikeNode from './group-like'
import MidConnect from './mid-connect'
import { DEFAULT_SIZE } from './measure'
import { useSize } from './utils'
import {
  isPrimaryGraphAtom,
  nodesBoxMap,
  selectedIdsAtom,
  sizeMapAtom,
} from '@/atom'
import { GRAPH_NODE_MARGIN_HORIZONTAL } from '@/constants'
import type * as AST from '@/parser/ast'

type Props = {
  id: string
  index: number
  x: number
  y: number
  nodes: AST.Node[]
}

const Nodes = React.memo(({ id, index, x, y, nodes }: Props) => {
  const sizeMap = useAtomValue(sizeMapAtom)
  const selectedIds = useAtomValue(selectedIdsAtom)
  const isPrimaryGraph = useAtomValue(isPrimaryGraphAtom)
  const [, boxHeight] = useSize(nodes, sizeMap).box

  const boxes = useMemo(() => {
    let curX = x
    return nodes.map((node) => {
      const [nodeWidth, nodeHeight] = (sizeMap.get(node) || DEFAULT_SIZE).box
      const nodeX = curX
      const nodeY = y + (boxHeight - nodeHeight) / 2
      curX += nodeWidth + GRAPH_NODE_MARGIN_HORIZONTAL
      return {
        x1: nodeX,
        y1: nodeY,
        x2: nodeX + nodeWidth,
        y2: nodeY + nodeHeight,
      }
    })
  }, [boxHeight, x, y, nodes, sizeMap])

  const contentBoxes = useMemo(() => {
    let curX = x
    return nodes.map((node) => {
      const { box: boxSize, content: contentSize }
        = sizeMap.get(node) || DEFAULT_SIZE
      const nodeX = curX + (boxSize[0] - contentSize[0]) / 2
      const nodeY = y + (boxHeight - contentSize[1]) / 2
      curX += boxSize[0] + GRAPH_NODE_MARGIN_HORIZONTAL
      return {
        x1: nodeX,
        y1: nodeY,
        x2: nodeX + contentSize[0],
        y2: nodeY + contentSize[1],
      }
    })
  }, [boxHeight, x, y, nodes, sizeMap])

  useEffect(() => {
    if (isPrimaryGraph) {
      nodesBoxMap.set(`${id}-${index}`, contentBoxes)
    }
    return () => {
      nodesBoxMap.delete(`${id}-${index}`)
    }
  }, [index, id, contentBoxes, isPrimaryGraph])

  const connectY = y + boxHeight / 2

  const dropXs = useMemo(() => {
    if (boxes.length === 0)
      return [x]
    return [
      boxes[0].x1 - GRAPH_NODE_MARGIN_HORIZONTAL / 2,
      ...boxes.map(box => box.x2 + GRAPH_NODE_MARGIN_HORIZONTAL / 2),
    ]
  }, [boxes, x])

  return (
    <>
      {dropXs.map((dropX, dropIndex) => {
        const dropKey = `insert:${id}:${index}:${dropIndex}`
        return (
          <rect
            key={`drop-${dropIndex}`}
            data-drop-container-id={id}
            data-drop-sequence-index={index}
            data-drop-index={dropIndex}
            data-drop-kind="insert"
            data-drop-key={dropKey}
            x={dropX - 8}
            y={y - 8}
            width={16}
            height={boxHeight + 16}
            className="fill-blue-500"
            opacity={0}
            rx={3}
            pointerEvents="none"
          />
        )
      })}
      {(['branch-before', 'branch-after'] as const).map((kind) => {
        const above = kind === 'branch-before'
        const dropKey = `${kind}:${id}:${index}:0`
        return (
          <g key={kind} opacity={0} pointerEvents="none">
            <rect
              data-drop-container-id={id}
              data-drop-sequence-index={index}
              data-drop-index={0}
              data-drop-kind={kind}
              data-drop-key={dropKey}
              x={x}
              y={above ? y - 24 : y + boxHeight + 8}
              width={Math.max((boxes.at(-1)?.x2 || x) - x, 48)}
              height={16}
              rx={8}
              className="fill-purple-500/30 stroke-purple-500"
            />
            <text
              x={x + 8}
              y={above ? y - 12 : y + boxHeight + 20}
              className="fill-purple-600 dark:fill-purple-300 text-[10px] font-sans pointer-events-none"
            >
              OR
            </text>
          </g>
        )
      })}
      {nodes.map((node, index) => {
        const { id } = node
        const box = boxes[index]
        const selected = selectedIds.includes(id)
        let Node: ReactNode = null
        switch (node.type) {
          case 'choice':
            Node = (
              <ChoiceNode
                x={box.x1}
                y={box.y1}
                node={node}
                selected={selected}
              />
            )
            break
          case 'group':
          case 'lookAroundAssertion':
            Node = (
              <GroupLikeNode
                x={box.x1}
                y={box.y1}
                node={node}
                selected={selected}
              />
            )
            break
          case 'root':
            Node = null
            break
          default:
            Node = (
              <SimpleNode
                x={box.x1}
                y={box.y1}
                node={node}
                selected={selected}
              />
            )
        }
        const Connect = index >= 1 && (
          <MidConnect
            start={[box.x1 - GRAPH_NODE_MARGIN_HORIZONTAL, connectY]}
            end={[box.x1, connectY]}
          />
        )
        return (
          <React.Fragment key={id}>
            {Connect}
            {Node}
          </React.Fragment>
        )
      })}
    </>
  )
})
Nodes.displayName = 'Nodes'

export default Nodes
