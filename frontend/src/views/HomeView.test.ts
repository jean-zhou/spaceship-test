/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { describe, expect, it } from 'vitest'

import homeViewSource from './HomeView.vue?raw'

const dashboardCss = readFileSync(
  fileURLToPath(new URL('../assets/main.css', import.meta.url)),
  'utf8',
)

describe('HomeView AI Query layout', () => {
  it('keeps AI Query focused on answers instead of query-plan metadata', () => {
    expect(homeViewSource).not.toContain('Query Plan')
    expect(homeViewSource).not.toContain('aiQueryPlanJson')
  })

  it('uses a wider charts panel while preserving the charts internal split', () => {
    expect(dashboardCss).toContain(
      'grid-template-columns: minmax(0, 1.35fr) minmax(340px, 0.65fr);',
    )
    expect(dashboardCss).toContain(
      'grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);',
    )
    expect(dashboardCss).toContain('min-height: 64px;')
    expect(homeViewSource).toContain('rows="2"')
  })

  it('keeps the insights row height stable while charts sit near the bottom edge', () => {
    expect(dashboardCss).toContain('--insights-row-height: 540px;')
    expect(dashboardCss).toContain('height: var(--insights-row-height);')
    expect(dashboardCss).toContain('justify-content: flex-end;')
    expect(dashboardCss).toContain('overflow: auto;')
    expect(dashboardCss).toContain('height: 180px;')
  })
})
