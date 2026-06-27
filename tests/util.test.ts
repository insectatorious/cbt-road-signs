import { describe, expect, it } from 'vitest'
import { gradeShadeLabel } from '../src/lib/util'
import type { Grade } from '../src/lib/types'

describe('gradeShadeLabel — recall shade words for SR announcements', () => {
  it('maps each grade to its shade word', () => {
    expect(gradeShadeLabel(0)).toBe('Again')
    expect(gradeShadeLabel(1)).toBe('Hard')
    expect(gradeShadeLabel(2)).toBe('Good')
    expect(gradeShadeLabel(3)).toBe('Easy')
  })

  it('covers every Grade value', () => {
    const grades: Grade[] = [0, 1, 2, 3]
    for (const g of grades) expect(gradeShadeLabel(g)).toMatch(/^(Again|Hard|Good|Easy)$/)
  })
})
