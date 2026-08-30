import { describe, expect, it } from 'vitest'

import {
  buildAiQueryPlan,
  buildAiVisualizationChartOption,
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

  it('maps AI bar visualization rows into a chart option', () => {
    const option = buildAiVisualizationChartOption({
      type: 'bar',
      data: [
        { group: 'FedEx', value: 12.5 },
        { group: 'UPS', value: 9.2 },
      ],
    })

    expect(option).not.toBeNull()
    expect(option!.xAxis.data).toEqual(['FedEx', 'UPS'])
    expect(option!.yAxis.name).toBe('Value')
    expect(option!.series[0]!.name).toBe('AI Query')
    expect(option!.series[0]!.data).toEqual([12.5, 9.2])
  })

  it('maps AI line visualization points into a chart option', () => {
    const option = buildAiVisualizationChartOption({
      type: 'line',
      data: [
        { month: '2025-11', historical: 40, forecast: null },
        { month: '2025-12', historical: null, forecast: 47 },
      ],
    })

    expect(option).not.toBeNull()
    expect(option!.xAxis.data).toEqual(['Nov 2025', 'Dec 2025'])
    expect(option!.series).toHaveLength(2)
    expect(option!.series[0]!.data).toEqual([40, null])
    expect(option!.series[1]!.data).toEqual([null, 47])
  })

  it('returns KPI metadata for AI kpi visualizations', () => {
    const result = buildAiVisualizationChartOption({
      type: 'kpi',
      data: { group: 'all', value: 27 },
    })

    expect(result).toBeNull()
  })

  it('builds a stable AI query plan from orchestration metadata', () => {
    expect(
      buildAiQueryPlan({
        selectedTool: 'query_logistics_analytics',
        toolInput: {
          queryType: 'ranking',
          metric: 'delay_rate',
          groupBy: 'carrier',
        },
      }),
    ).toEqual({
      tool: 'query_logistics_analytics',
      input: {
        queryType: 'ranking',
        metric: 'delay_rate',
        groupBy: 'carrier',
      },
      sourceOfTruth: 'computed_by_backend_tool',
    })
  })
})
