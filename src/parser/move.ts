import { nanoid } from 'nanoid'
import type * as AST from './ast'
import { makeChoiceValid } from './modifiers/choice'
import { getContiguousNodesByIds, getNodeById, visitNodes } from './visit'

export type DropPosition = {
  kind?: 'insert' | 'branch-before' | 'branch-after'
  containerId: string
  sequenceIndex: number
  index: number
}

function cloneQuantifier(quantifier: AST.Quantifier | null) {
  return quantifier && { ...quantifier }
}

function cloneNode(node: AST.Node): AST.Node {
  switch (node.type) {
    case 'choice':
      return {
        ...node,
        branches: node.branches.map(branch => branch.map(cloneNode)),
      }
    case 'group':
      return {
        ...node,
        children: node.children.map(cloneNode),
        quantifier: cloneQuantifier(node.quantifier),
      }
    case 'lookAroundAssertion':
      return { ...node, children: node.children.map(cloneNode) }
    case 'character':
      return node.kind === 'ranges'
        ? {
            ...node,
            ranges: node.ranges.map(range => ({ ...range })),
            quantifier: cloneQuantifier(node.quantifier),
          }
        : { ...node, quantifier: cloneQuantifier(node.quantifier) }
    case 'backReference':
      return { ...node, quantifier: cloneQuantifier(node.quantifier) }
    default:
      return { ...node }
  }
}

function cloneRegex(ast: AST.Regex): AST.Regex {
  return {
    ...ast,
    body: ast.body.map(cloneNode),
    flags: [...ast.flags],
  }
}

function getSequence(ast: AST.Regex, position: DropPosition): AST.Node[] | null {
  let result: AST.Node[] | null = null
  visitNodes(ast, (containerId, sequenceIndex, nodes) => {
    if (containerId === position.containerId && sequenceIndex === position.sequenceIndex) {
      result = nodes
      return true
    }
    return false
  })
  return result
}

function containsContainer(node: AST.Node, containerId: string) {
  if (node.id === containerId)
    return true
  let contains = false
  visitNodes(node, (id) => {
    if (id === containerId) {
      contains = true
      return true
    }
    return false
  })
  return contains
}

/** Checks whether a move can be applied without cloning or changing the AST. */
export function canMoveNodes(
  ast: AST.Regex,
  nodeIds: string[],
  position: DropPosition,
): boolean {
  if (nodeIds.length === 0)
    return false
  try {
    const sourceNodes = getContiguousNodesByIds(ast, nodeIds)
    if (sourceNodes.length === 0)
      return false
    if (sourceNodes.some(node => containsContainer(node, position.containerId))) {
      return false
    }
    const target = getSequence(ast, position)
    if (!target || position.index < 0 || position.index > target.length)
      return false
    if (position.kind !== 'branch-before' && position.kind !== 'branch-after')
      return true
    if (position.containerId === ast.id)
      return true
    const container = getNodeById(ast, position.containerId).node
    return container.type === 'choice'
      || container.type === 'group'
      || container.type === 'lookAroundAssertion'
  } catch {
    return false
  }
}

function replaceWithChoice(
  target: AST.Node[],
  moved: AST.Node[],
  kind: 'branch-before' | 'branch-after',
) {
  if (target.length === 1 && target[0].type === 'choice') {
    const choice = target[0]
    const branchIndex = kind === 'branch-before' ? 0 : choice.branches.length
    choice.branches.splice(branchIndex, 0, moved)
    return
  }
  const existingBranch = [...target]
  const branches = kind === 'branch-before'
    ? [moved, existingBranch]
    : [existingBranch, moved]
  target.splice(0, target.length, {
    id: nanoid(),
    type: 'choice',
    branches,
  })
}

function cleanupVacatedSourceChoice(
  ast: AST.Regex,
  sourceParent: AST.ParentNode,
  sourceList: AST.Node[],
) {
  if (sourceParent.type !== 'choice' || sourceList.length > 0)
    return ast

  sourceParent.branches = sourceParent.branches.filter(branch => branch !== sourceList)
  if (sourceParent.branches.length <= 1) {
    const replacement = sourceParent.branches[0] || []
    const { nodeList, index } = getNodeById(ast, sourceParent.id)
    nodeList.splice(index, 1, ...replacement)
  }
  return ast
}

/** Returns a moved copy of the AST, or null when the move is invalid. */
export function moveNodes(
  ast: AST.Regex,
  nodeIds: string[],
  position: DropPosition,
): AST.Regex | null {
  if (!canMoveNodes(ast, nodeIds, position))
    return null

  const next = cloneRegex(ast)
  const nextSource = getNodeById(next, nodeIds[0])
  const sourceParent = nextSource.parent
  const sourceList = nextSource.nodeList
  const nextTarget = getSequence(next, position)
  if (!nextTarget || position.index < 0 || position.index > nextTarget.length)
    return null

  const sameSequence = nextSource.nodeList === nextTarget
  const removed = nextSource.nodeList.splice(nextSource.index, nodeIds.length)
  if (position.kind === 'branch-before' || position.kind === 'branch-after') {
    if (position.containerId === next.id) {
      replaceWithChoice(nextTarget, removed, position.kind)
      return cleanupVacatedSourceChoice(next, sourceParent, sourceList)
    }

    const container = getNodeById(next, position.containerId).node
    if (container.type === 'choice') {
      const branchIndex = position.kind === 'branch-before'
        ? position.sequenceIndex
        : position.sequenceIndex + 1
      container.branches.splice(branchIndex, 0, removed)
      return cleanupVacatedSourceChoice(next, sourceParent, sourceList)
    }

    if (container.type === 'group' || container.type === 'lookAroundAssertion') {
      replaceWithChoice(nextTarget, removed, position.kind)
      return cleanupVacatedSourceChoice(next, sourceParent, sourceList)
    }
    return null
  }

  let insertionIndex = position.index
  if (sameSequence) {
    const sourceEnd = nextSource.index + nodeIds.length
    if (position.index >= nextSource.index && position.index <= sourceEnd)
      insertionIndex = nextSource.index
    else if (position.index > sourceEnd)
      insertionIndex -= nodeIds.length
  }
  nextTarget.splice(insertionIndex, 0, ...removed)
  const moved = cleanupVacatedSourceChoice(next, sourceParent, sourceList)
  makeChoiceValid(moved)
  return moved
}
