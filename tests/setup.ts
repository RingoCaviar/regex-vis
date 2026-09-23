import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import 'vitest-canvas-mock'

class TestPointerEvent extends MouseEvent {
  pointerId: number
  pointerType: string

  constructor(type: string, properties: PointerEventInit = {}) {
    super(type, properties)
    this.pointerId = properties.pointerId || 0
    this.pointerType = properties.pointerType || 'mouse'
  }
}

Object.defineProperty(window, 'PointerEvent', {
  configurable: true,
  value: TestPointerEvent,
})

afterEach(() => {
  cleanup()
})
