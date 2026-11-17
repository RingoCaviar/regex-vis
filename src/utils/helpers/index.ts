import { splitExpression } from '@/regex-engine/evaluate'

export function genPermalink(tests: string[] = [], flags?: string) {
  const url = new URL(window.location.href)
  const input = url.searchParams.get('r') || ''
  const { pattern } = splitExpression(input, '')
  if (flags !== undefined && (flags !== '' || pattern !== input))
    url.searchParams.set('r', `/${pattern}/${flags}`)
  if (tests.length > 0) {
    url.searchParams.set('t', JSON.stringify(tests))
  }
  return url.toString()
}
