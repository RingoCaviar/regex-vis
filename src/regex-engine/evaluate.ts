export type RegexEngine = 'javascript' | 'mihomo'

export type MatchRequest = {
  engine: RegexEngine
  pattern: string
  flags: string
  values: string[]
}

export type MatchResponse = {
  results?: boolean[]
  error?: string
}

export function splitExpression(input: string, flags: string): { pattern: string, flags: string } {
  const end = input.lastIndexOf('/')
  if (input.startsWith('/') && end > 0) {
    return { pattern: input.slice(1, end), flags: input.slice(end + 1) }
  }
  return { pattern: input, flags }
}

export function evaluateJavaScript({ pattern, flags, values }: MatchRequest): MatchResponse {
  try {
    const expression = new RegExp(pattern, flags)
    return {
      results: values.map((value) => {
        expression.lastIndex = 0
        return expression.test(value)
      }),
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
