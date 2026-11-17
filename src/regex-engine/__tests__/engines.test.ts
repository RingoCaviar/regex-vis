import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { MatchRequest } from '../evaluate'
import { evaluateJavaScript, splitExpression } from '../evaluate'
import { evaluateMihomo, initializeMihomo } from '../mihomo'

beforeAll(async () => {
  const bytes = await readFile(path.resolve('src/regex-engine/regexp2.wasm'))
  await initializeMihomo(bytes)
})

const userPattern = String.raw`^\[(?:SF|fish|chuixue|ziyong|ziyong2)\]\s*.*?(?:美国|新加坡|日本|[Aa][Ii])((.*?)(?:家宽|电信|移联|专用节点\s*[-－—]\s*(?:美国|新加坡|日本)|实验性)|\b)`

function request(pattern: string, values: string[], flags = ''): MatchRequest {
  return { engine: 'mihomo', pattern, values, flags }
}

describe('matching engines', () => {
  it('reproduces the user’s filter difference using the actual regexp2 engine', () => {
    const input = request(userPattern, ['[ziyong2] 美国111', '[ziyong2] 美国家宽', '[other] 美国111'])
    expect(evaluateJavaScript(input)).toEqual({ results: [true, true, false] })
    expect(evaluateMihomo(input)).toEqual({ results: [false, true, false] })
    expect(evaluateMihomo(request(userPattern.replace('|\\b)', '|\\b|[0-9])'), input.values)))
      .toEqual({ results: [true, true, false] })
  })

  it('uses Unicode character classes in Mihomo mode', () => {
    const input = request(String.raw`^\w+\d$`, ['美国1', 'hello１', 'hello1'])
    expect(evaluateJavaScript(input)).toEqual({ results: [false, false, true] })
    expect(evaluateMihomo(input)).toEqual({ results: [true, true, true] })
  })

  it('accepts Mihomo inline options and backtick-separated filters', () => {
    expect(evaluateMihomo(request('(?i)^us$`日本', ['US', '日本111', 'UK'])))
      .toEqual({ results: [true, true, false] })
  })

  it('supports flags without sharing global match state between cases', () => {
    const input = request('^a.b$', ['A\nB', 'A\nB', 'no'], 'gis')
    expect(evaluateJavaScript(input)).toEqual({ results: [true, true, false] })
    expect(evaluateMihomo(input)).toEqual({ results: [true, true, false] })
  })

  it('reports invalid patterns and unsupported Mihomo flags as errors', () => {
    expect(evaluateJavaScript(request('[', ['a'])).error).toBeTruthy()
    expect(evaluateMihomo(request('[', ['a'])).error).toBeTruthy()
    expect(evaluateMihomo(request('a', ['a'], 'u')).error).toContain('Unsupported Mihomo flag')
  })

  it('preserves literal flags and raw expressions without compiling as JavaScript', () => {
    expect(splitExpression('/a+/im', 'g')).toEqual({ pattern: 'a+', flags: 'im' })
    expect(splitExpression('(?i)美国', '')).toEqual({ pattern: '(?i)美国', flags: '' })
    expect(splitExpression('/a/invalid', '')).toEqual({ pattern: 'a', flags: 'invalid' })
  })
})
