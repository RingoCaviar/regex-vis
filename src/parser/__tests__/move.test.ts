import { describe, expect, it, vi } from 'vitest'
import { canMoveNodes, gen, moveNodes, parse } from '..'

function regex(source: string) {
  const result = parse(source)
  if (result.type !== 'regex')
    throw new Error(result.message)
  return result
}

describe('moveNodes', () => {
  it('rejects moving a selection spanning different branches as one block', () => {
    const ast = regex('(a|b)c')
    const group = ast.body[0]
    if (group.type !== 'group' || group.children[0].type !== 'choice')
      throw new Error('Unexpected fixture AST')
    const choice = group.children[0]
    const ids = [choice.branches[0][0].id, choice.branches[1][0].id]
    const target = { containerId: ast.id, sequenceIndex: 0, index: 2 }
    expect(canMoveNodes(ast, ids, target)).toBe(false)
    expect(moveNodes(ast, ids, target)).toBeNull()
    expect(gen(ast)).toBe('(a|b)c')
  })

  it('checks drop validity without producing a moved AST', () => {
    const ast = regex('(a)b')
    const group = ast.body[0]
    if (group.type !== 'group')
      throw new Error('Unexpected fixture AST')

    expect(canMoveNodes(ast, [ast.body[1].id], {
      containerId: group.id,
      sequenceIndex: 0,
      index: 1,
    })).toBe(true)
    expect(canMoveNodes(ast, [group.id], {
      containerId: group.id,
      sequenceIndex: 0,
      index: 1,
    })).toBe(false)
  })
  it('moves a contiguous block to a different node sequence without mutating the source', () => {
    const ast = regex('a(b|c)d')
    const original = gen(ast)
    const group = ast.body[1]
    if (group.type !== 'group' || group.children[0].type !== 'choice')
      throw new Error('Unexpected fixture AST')
    const choice = group.children[0]

    const moved = moveNodes(ast, [ast.body[0].id], {
      containerId: choice.id,
      sequenceIndex: 1,
      index: 1,
    })

    expect(moved && gen(moved)).toBe('(b|ca)d')
    expect(gen(ast)).toBe(original)
  })

  it('corrects the insertion index when moving within one sequence', () => {
    const ast = regex('a\\db')

    const moved = moveNodes(ast, [ast.body[0].id], {
      containerId: ast.id,
      sequenceIndex: 0,
      index: 3,
    })

    expect(moved && gen(moved)).toBe('\\dba')
  })

  it('keeps a block in place when dropped inside itself', () => {
    const ast = regex('a\\db')

    const moved = moveNodes(ast, [ast.body[1].id, ast.body[2].id], {
      containerId: ast.id,
      sequenceIndex: 0,
      index: 2,
    })

    expect(moved && gen(moved)).toBe('a\\db')
  })

  it('moves a contiguous block together across containers', () => {
    const ast = regex('a\\db(c)')
    const group = ast.body[3]
    if (group.type !== 'group')
      throw new Error('Unexpected fixture AST')

    const moved = moveNodes(ast, [ast.body[0].id, ast.body[1].id], {
      containerId: group.id,
      sequenceIndex: 0,
      index: 0,
    })

    expect(moved && gen(moved)).toBe('b(a\\dc)')
  })

  it('removes an empty choice branch after its node moves away', () => {
    const ast = regex('a|b')
    const choice = ast.body[0]
    if (choice.type !== 'choice')
      throw new Error('Unexpected fixture AST')

    const moved = moveNodes(ast, [choice.branches[0][0].id], {
      containerId: choice.id,
      sequenceIndex: 1,
      index: 1,
    })

    expect(moved && gen(moved)).toBe('ba')
  })

  it('preserves unrelated intentional empty alternatives', () => {
    const ast = regex('(a||b)\\d(c)')
    const target = ast.body[2]
    if (target.type !== 'group')
      throw new Error('Unexpected fixture AST')

    const moved = moveNodes(ast, [ast.body[1].id], {
      containerId: target.id,
      sequenceIndex: 0,
      index: 0,
    })

    expect(moved && gen(moved)).toBe('(a||b)(\\dc)')
  })

  it('rejects moving a compound node into its own descendant', () => {
    const ast = regex('(a)b')
    const group = ast.body[0]
    if (group.type !== 'group')
      throw new Error('Unexpected fixture AST')

    expect(moveNodes(ast, [group.id], {
      containerId: group.id,
      sequenceIndex: 0,
      index: 1,
    })).toBeNull()
  })

  it('creates a choice by dropping nodes above a regular sequence', () => {
    const ast = regex('a\\db')

    const moved = moveNodes(ast, [ast.body[2].id], {
      kind: 'branch-before',
      containerId: ast.id,
      sequenceIndex: 0,
      index: 0,
    })

    expect(moved && gen(moved)).toBe('b|a\\d')
  })

  it('adds a branch to an existing choice instead of nesting another choice', () => {
    const ast = regex('a|b\\d')
    const choice = ast.body[0]
    if (choice.type !== 'choice')
      throw new Error('Unexpected fixture AST')

    const moved = moveNodes(ast, [choice.branches[1][1].id], {
      kind: 'branch-before',
      containerId: choice.id,
      sequenceIndex: 1,
      index: 0,
    })

    expect(moved && gen(moved)).toBe('a|\\d|b')
  })

  it('adds a branch through the outer position of an existing root choice', () => {
    const ast = regex('a|b\\d')
    const choice = ast.body[0]
    if (choice.type !== 'choice')
      throw new Error('Unexpected fixture AST')

    const moved = moveNodes(ast, [choice.branches[1][1].id], {
      kind: 'branch-before',
      containerId: ast.id,
      sequenceIndex: 0,
      index: 0,
    })

    expect(moved && gen(moved)).toBe('\\d|a|b')
  })

  it('preserves the meaning when moving a node after a choice', () => {
    const ast = regex('a|b\\d')
    const choice = ast.body[0]
    if (choice.type !== 'choice')
      throw new Error('Unexpected fixture AST')

    const moved = moveNodes(ast, [choice.branches[1][1].id], {
      containerId: ast.id,
      sequenceIndex: 0,
      index: 1,
    })

    expect(moved && gen(moved)).toBe('(?:a|b)\\d')
  })

  it('moves nodes when structuredClone is unavailable', () => {
    vi.stubGlobal('structuredClone', undefined)
    const ast = regex('a\\db')

    try {
      const moved = moveNodes(ast, [ast.body[0].id], {
        containerId: ast.id,
        sequenceIndex: 0,
        index: 3,
      })

      expect(moved && gen(moved)).toBe('\\dba')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
