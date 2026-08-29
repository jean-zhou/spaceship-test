import type { EChartsOption } from 'echarts'

const EMPTY_VALUE = 'all'
const ORDER_VOLUME_COLOR = '#2563eb'
const STATUS_COLORS: Record<string, string> = {
  delivered: '#138a52',
  delayed: '#c24136',
  in_transit: '#b7791f',
  cancelled: '#65727c',
  canceled: '#65727c',
}

export interface LogisticsDashboardFilters {
  dateRange?: string
  carrier?: string
  region?: string
  status?: string
  search?: string
}

export interface LogisticsMonthlyOrderVolume {
  month: string
  orders: number
}

export interface LogisticsStatusMix {
  status: string
  label: string
  count: number
  percentage: number
}

interface AxisOption {
  type: 'category' | 'value'
  data?: string[]
  name?: string
  minInterval?: number
  axisTick?: { show: boolean }
  axisLine?: { lineStyle: { color: string } }
  axisLabel?: { color: string }
  splitLine?: { lineStyle: { color: string } }
  nameTextStyle?: { color: string; fontWeight: number }
}

interface StatusSeriesDatum {
  value: number
  percentage: number
  status: string
}

interface SeriesOption {
  name: string
  type: 'bar'
  data: number[] | StatusSeriesDatum[]
  barMaxWidth: number
  itemStyle: {
    borderRadius: number[]
    color: string | ((params: unknown) => string)
  }
  label?: {
    show: boolean
    position: 'right'
    color: string
    formatter: (params: unknown) => string
  }
}

interface LogisticsChartOption extends EChartsOption {
  animationDuration: number
  color?: string[]
  grid: {
    top: number
    right: number
    bottom: number
    left: number
    containLabel: boolean
  }
  tooltip: {
    trigger: 'axis' | 'item'
    axisPointer?: { type: 'shadow' }
    valueFormatter?: (value: unknown) => string
    formatter?: (params: unknown) => string
  }
  xAxis: AxisOption
  yAxis: AxisOption
  series: SeriesOption[]
}

export function buildKpiQuery(filters: LogisticsDashboardFilters): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    const normalized = String(value ?? '').trim()

    if (!normalized || normalized === EMPTY_VALUE) {
      continue
    }

    params.set(key, normalized)
  }

  return params.toString()
}

export function formatOnTimeRate(value: number): string {
  return `${Number(value).toFixed(1)}%`
}

export function formatAverageDeliveryTime(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '--'
  }

  return `${Number(value).toFixed(2)}d`
}

export function buildOrderVolumeChartOption(
  monthlyOrderVolume: LogisticsMonthlyOrderVolume[],
): LogisticsChartOption {
  return {
    animationDuration: 450,
    color: [ORDER_VOLUME_COLOR],
    grid: {
      top: 28,
      right: 18,
      bottom: 30,
      left: 42,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (value) => formatInteger(value),
    },
    xAxis: {
      type: 'category',
      data: monthlyOrderVolume.map((item) => formatMonthLabel(item.month)),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dbe3e7' } },
      axisLabel: { color: '#65727c' },
    },
    yAxis: {
      type: 'value',
      name: 'Orders',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#eef2f4' } },
      axisLabel: { color: '#65727c' },
      nameTextStyle: { color: '#65727c', fontWeight: 700 },
    },
    series: [
      {
        name: 'Orders',
        type: 'bar',
        data: monthlyOrderVolume.map((item) => item.orders),
        barMaxWidth: 34,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: ORDER_VOLUME_COLOR,
        },
      },
    ],
  }
}

export function buildStatusMixChartOption(statusMix: LogisticsStatusMix[]): LogisticsChartOption {
  return {
    animationDuration: 450,
    grid: {
      top: 24,
      right: 64,
      bottom: 24,
      left: 96,
      containLabel: true,
    },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const data = getStatusSeriesDatum(params)

        return `${data.status}: ${formatInteger(data.value)} (${Number(data.percentage).toFixed(1)}%)`
      },
    },
    xAxis: {
      type: 'value',
      name: 'Orders',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#eef2f4' } },
      axisLabel: { color: '#65727c' },
      nameTextStyle: { color: '#65727c', fontWeight: 700 },
    },
    yAxis: {
      type: 'category',
      data: statusMix.map((item) => item.label),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dbe3e7' } },
      axisLabel: { color: '#172026' },
    },
    series: [
      {
        name: 'Status mix',
        type: 'bar',
        data: statusMix.map((item) => ({
          value: item.count,
          percentage: item.percentage,
          status: item.status,
        })),
        barMaxWidth: 18,
        label: {
          show: true,
          position: 'right',
          color: '#65727c',
          formatter: (params) => {
            const data = getStatusSeriesDatum(params)

            return `${formatInteger(data.value)} · ${Number(data.percentage).toFixed(1)}%`
          },
        },
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: (params) => getStatusColor(getStatusSeriesDatum(params).status),
        },
      },
    ],
  }
}

function formatMonthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00Z`)

  return new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date)
}

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#7c3aed'
}

function getStatusSeriesDatum(params: unknown): StatusSeriesDatum {
  if (
    params !== null &&
    typeof params === 'object' &&
    'data' in params &&
    isStatusSeriesDatum(params.data)
  ) {
    return params.data
  }

  return { value: 0, percentage: 0, status: '' }
}

function isStatusSeriesDatum(value: unknown): value is StatusSeriesDatum {
  return (
    value !== null &&
    typeof value === 'object' &&
    'value' in value &&
    'percentage' in value &&
    'status' in value &&
    typeof value.value === 'number' &&
    typeof value.percentage === 'number' &&
    typeof value.status === 'string'
  )
}

function formatInteger(value: unknown): string {
  return new Intl.NumberFormat('en-US').format(Number(value))
}
