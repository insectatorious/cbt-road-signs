import { describe, expect, it } from 'vitest'
import { clampThink, gradeFromRecall, shadeFromTime, updateBaseline } from '../src/lib/pace'

describe('clampThink', () => {
  it('floors misclicks and caps away-time', () => {
    expect(clampThink(50)).toBe(400)
    expect(clampThink(10 ** 9)).toBe(30000)
    expect(clampThink(5000)).toBe(5000)
  })
})

describe('updateBaseline', () => {
  it('seeds from the first sample', () => {
    expect(updateBaseline(undefined, 4000)).toBe(4000)
  })
  it('moves slowly toward new samples (EMA)', () => {
    const b = updateBaseline(4000, 8000)
    expect(b).toBeGreaterThan(4000)
    expect(b).toBeLessThan(5000) // small alpha → small step
  })
  it('clamps outlier samples before mixing them in', () => {
    expect(updateBaseline(5000, 10 ** 9)).toBeLessThan(8500) // 30s cap, not a billion
  })
})

describe('shadeFromTime (correct recalls only)', () => {
  it('fast relative to your pace → Easy', () => {
    expect(shadeFromTime(2000, 5000)).toBe(3)
  })
  it('around your pace → Good', () => {
    expect(shadeFromTime(5000, 5000)).toBe(2)
  })
  it('slow relative to your pace → Hard', () => {
    expect(shadeFromTime(12000, 5000)).toBe(1)
  })
  it('adapts: the same 4s is Easy for a slow user, Hard for a fast user', () => {
    expect(shadeFromTime(4000, 9000)).toBe(3) // ratio 0.44 → Easy
    expect(shadeFromTime(4000, 2000)).toBe(1) // ratio 2.0 → Hard
  })
  it('falls back sensibly before a baseline exists', () => {
    expect(shadeFromTime(1500, undefined)).toBe(3)
    expect(shadeFromTime(5000, undefined)).toBe(2)
  })
})

describe('gradeFromRecall', () => {
  it('Missed is always Again, regardless of time', () => {
    expect(gradeFromRecall(false, 800, 5000)).toBe(0)
    expect(gradeFromRecall(false, 20000, 5000)).toBe(0)
  })
  it('Got it maps to a time-based shade', () => {
    expect(gradeFromRecall(true, 2000, 5000)).toBe(3)
    expect(gradeFromRecall(true, 12000, 5000)).toBe(1)
  })
})

describe('idle / looked-away handling', () => {
  it('treats a looked-away reveal as a neutral Good, not Hard', () => {
    expect(shadeFromTime(25000, 1500)).toBe(2) // ratio would be Hard, but it is idle
  })
  it('never lets idle time skew the baseline', () => {
    expect(updateBaseline(1500, 25000)).toBe(1500) // unchanged
    expect(updateBaseline(undefined, 25000)).toBeUndefined() // not seeded from idle
  })
})

describe('corrupt-baseline defense', () => {
  it('falls back instead of wedging on 0 / NaN / negative baselines', () => {
    expect(shadeFromTime(1500, 0)).toBe(3) // not Infinity → Hard
    expect(shadeFromTime(5000, Number.NaN)).toBe(2) // not NaN → always-Good
    expect(shadeFromTime(1500, -10)).toBe(3) // not negative → Easy-by-accident
  })
  it('re-seeds from a fresh sample when the stored baseline is poisoned', () => {
    expect(updateBaseline(Number.NaN, 3000)).toBe(3000)
  })
})
