import { describe, expect, it } from 'vitest'
import { nextFocusIndex } from '../src/lib/a11y'

describe('nextFocusIndex — focus-trap cycling', () => {
  it('moves forward through interior controls', () => {
    expect(nextFocusIndex(3, 0, false)).toBe(1)
    expect(nextFocusIndex(3, 1, false)).toBe(2)
  })

  it('wraps from the last element back to the first on Tab', () => {
    expect(nextFocusIndex(3, 2, false)).toBe(0)
  })

  it('wraps from the first element to the last on Shift+Tab', () => {
    expect(nextFocusIndex(3, 0, true)).toBe(2)
    expect(nextFocusIndex(3, 1, true)).toBe(0)
  })

  it('pulls focus back in when it has escaped the trap (current = -1)', () => {
    expect(nextFocusIndex(3, -1, false)).toBe(0) // Tab → first
    expect(nextFocusIndex(3, -1, true)).toBe(2) // Shift+Tab → last
  })

  it('returns -1 when there is nothing focusable', () => {
    expect(nextFocusIndex(0, -1, false)).toBe(-1)
    expect(nextFocusIndex(0, 0, true)).toBe(-1)
  })

  it('a single focusable element always cycles to itself', () => {
    expect(nextFocusIndex(1, 0, false)).toBe(0)
    expect(nextFocusIndex(1, 0, true)).toBe(0)
  })
})
