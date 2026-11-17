import { atom } from 'jotai'
import { astAtom, nodesBoxMap, selectedIdsAtom } from './atoms'
import type { AST } from '@/parser'
import { getContiguousNodesByIds, visit, visitNodes } from '@/parser'
import type { SelectionMode } from '@/utils/selection'

export const clearSelectedAtom = atom(null, (get, set) => {
  set(selectedIdsAtom, [])
})

export const contiguousSelectedNodesAtom = atom(get =>
  getContiguousNodesByIds(get(astAtom), get(selectedIdsAtom)),
)

export const selectNodesAtom = atom(null, (get, set, ids: string[], mode: SelectionMode = 'replace') => {
  const selectedIds = get(selectedIdsAtom)
  if (mode === 'replace') {
    set(selectedIdsAtom, ids)
  } else if (mode === 'subtract') {
    set(selectedIdsAtom, selectedIds.filter(id => !ids.includes(id)))
  } else {
    const nextIds = new Set([...selectedIds, ...ids])
    const orderedIds: string[] = []
    visit(get(astAtom), (node) => {
      if (nextIds.has(node.id))
        orderedIds.push(node.id)
    })
    set(selectedIdsAtom, orderedIds)
  }
})

export const selectNodeAtom = atom(null, (get, set, id: string, mode: SelectionMode = 'replace') => {
  const selectedIds = get(selectedIdsAtom)
  if (mode === 'replace' && selectedIds.length === 1 && selectedIds[0] === id) {
    set(selectedIdsAtom, [])
  } else {
    set(selectNodesAtom, [id], mode)
  }
})

export const selectNodesByBoxAtom = atom(
  null,
  (get, set, box: { x1: number, y1: number, x2: number, y2: number }, mode: SelectionMode = 'replace') => {
    const ast = get(astAtom)
    const ids: string[] = []
    const coveredContainers = new Set<string>()
    visitNodes(ast, (id: string, index: number, nodes: AST.Node[]) => {
      if (coveredContainers.has(id))
        return false
      const boxes = nodesBoxMap.get(`${id}-${index}`) || []
      for (let i = 0; i < boxes.length; i++) {
        const nodeBox = boxes[i]
        if (
          box.x1 <= nodeBox.x1
          && box.x2 >= nodeBox.x2
          && box.y1 <= nodeBox.y1
          && box.y2 >= nodeBox.y2
        ) {
          ids.push(nodes[i].id)
          // Adding a container selects it as a whole; subtraction must also
          // visit its children so previously selected descendants are removed.
          if (mode === 'add') {
            visitNodes(nodes[i], (containerId) => {
              coveredContainers.add(containerId)
            })
          }
        } else if (mode === 'replace' && ids.length > 0) {
          break
        }
      }
      if (mode === 'replace' && ids.length > 0) {
        return true
      }
      return false
    })
    set(selectNodesAtom, ids, mode)
  },
)
