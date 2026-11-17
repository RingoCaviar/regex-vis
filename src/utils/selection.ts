export type SelectionMode = 'replace' | 'add' | 'subtract'

export function getSelectionMode(event: { shiftKey: boolean, ctrlKey: boolean }): SelectionMode {
  if (event.ctrlKey)
    return 'subtract'
  return event.shiftKey ? 'add' : 'replace'
}
