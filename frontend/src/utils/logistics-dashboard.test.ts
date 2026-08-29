import { describe, expect, it } from 'vitest'

import {
  buildKpiQuery,
  buildOrderVolumeChartOption,
  buildStatusMixChartOption,
  formatAverageDeliveryTime,
  formatOnTimeRate,
} from './logistics-dashboard'

describe('logistics dashboard utils', () => {
  it('omits all and empty filter values from KPI query strings', () => {
    expect(
      buildKpiQuery({
        dateRange: 'all',
        carrier: 'FedEx',
        region: '',
        status: 'all',
        search: ' paper ',
      }),
    ).toBe('carrier=FedEx&search=paper')
  })

  it('formats KPI rates and null delivery time for dashboard cards', () => {
    expect(formatOnTimeRate(84.7)).toBe('84.7%')
    expect(formatAverageDeliveryTime(3.83)).toBe('3.83d')
    expect(formatAverageDeliveryTime(null)).toBe('--')
  })

  it('maps monthly order buckets into order volume chart axes', () => {
    const option = buildOrderVolumeChartOption([
      { month: '2025-01', orders: 12 },
      { month: '2025-02', orders: 0 },
      { month: '2025-03', orders: 7 },
    ])

    expect(option.xAxis.data).toEqual(['Jan', 'Feb', 'Mar'])
    expect(option.yAxis.name).toBe('Orders')
    const series = option.series[0]

    expect(series).toBeDefined()
    expect(series!.name).toBe('Orders')
    expect(series!.data).toEqual([12, 0, 7])
  })

  it('maps status counts and percentages into horizontal status bars', () => {
    const option = buildStatusMixChartOption([
      { status: 'delivered', label: 'delivered', count: 8, percentage: 80 },
      { status: 'delayed', label: 'delayed', count: 2, percentage: 20 },
    ])

    expect(option.yAxis.data).toEqual(['delivered', 'delayed'])
    expect(option.xAxis.name).toBe('Orders')
    const series = option.series[0]

    expect(series).toBeDefined()
    expect(series!.name).toBe('Status mix')
    expect(series!.data).toEqual([
      { value: 8, percentage: 80, status: 'delivered' },
      { value: 2, percentage: 20, status: 'delayed' },
    ])
  })
})
