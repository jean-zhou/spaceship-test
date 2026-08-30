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
  type: 'bar' | 'line'
  data: Array<number | null> | StatusSeriesDatum[]
  barMaxWidth?: number
  smooth?: boolean
  connectNulls?: boolean
  symbolSize?: number
  itemStyle?: {
    borderRadius: number[]
    color: string | ((params: unknown) => string)
  }
  lineStyle?: {
    width: number
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

export type AiVisualizationType = 'line' | 'bar' | 'table' | 'kpi'

export interface AiVisualization {
  type: AiVisualizationType
  data: unknown
}

export interface AiQueryPlanInput {
  selectedTool: string
  toolInput: Record<string, unknown>
}

export interface AiQueryPlan {
  tool: string
  input: Record<string, unknown>
  sourceOfTruth: 'computed_by_backend_tool'
}

interface AiBarDatum {
  group?: string
  value: number
}

interface AiLineDatum {
  month?: string
  group?: string
  historical?: number | null
  forecast?: number | null
  value?: number | null
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

export function buildAiVisualizationChartOption(
  visualization: AiVisualization,
): LogisticsChartOption | null {
  if (visualization.type === 'bar') {
    return buildAiBarChartOption(visualization.data)
  }

  if (visualization.type === 'line') {
    return buildAiLineChartOption(visualization.data)
  }

  return null
}

export function buildAiQueryPlan(input: AiQueryPlanInput): AiQueryPlan {
  return {
    tool: input.selectedTool,
    input: input.toolInput,
    sourceOfTruth: 'computed_by_backend_tool',
  }
}

function buildAiBarChartOption(data: unknown): LogisticsChartOption | null {
  if (!Array.isArray(data)) {
    return null
  }

  const rows = data.filter(isAiBarDatum)

  if (rows.length === 0) {
    return null
  }

  return {
    animationDuration: 450,
    color: [ORDER_VOLUME_COLOR],
    grid: {
      top: 24,
      right: 18,
      bottom: 34,
      left: 46,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (value) => formatNumber(value),
    },
    xAxis: {
      type: 'category',
      data: rows.map((item) => item.group ?? 'Result'),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dbe3e7' } },
      axisLabel: { color: '#65727c' },
    },
    yAxis: {
      type: 'value',
      name: 'Value',
      splitLine: { lineStyle: { color: '#eef2f4' } },
      axisLabel: { color: '#65727c' },
      nameTextStyle: { color: '#65727c', fontWeight: 700 },
    },
    series: [
      {
        name: 'AI Query',
        type: 'bar',
        data: rows.map((item) => item.value),
        barMaxWidth: 32,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: ORDER_VOLUME_COLOR,
        },
      },
    ],
  }
}

function buildAiLineChartOption(data: unknown): LogisticsChartOption | null {
  if (!Array.isArray(data)) {
    return null
  }

  const rows = data.filter(isAiLineDatum)

  if (rows.length === 0) {
    return null
  }

  return {
    animationDuration: 450,
    color: [ORDER_VOLUME_COLOR, STATUS_COLORS.delayed ?? '#c24136'],
    grid: {
      top: 24,
      right: 18,
      bottom: 34,
      left: 46,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => formatNumber(value),
    },
    xAxis: {
      type: 'category',
      data: rows.map((item) => formatAiLineLabel(item.month ?? item.group ?? '')),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dbe3e7' } },
      axisLabel: { color: '#65727c' },
    },
    yAxis: {
      type: 'value',
      name: 'Quantity',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#eef2f4' } },
      axisLabel: { color: '#65727c' },
      nameTextStyle: { color: '#65727c', fontWeight: 700 },
    },
    series: [
      {
        name: 'Historical',
        type: 'line',
        data: rows.map((item) => item.historical ?? item.value ?? null),
        smooth: true,
        connectNulls: false,
        symbolSize: 7,
        lineStyle: { width: 3 },
      },
      {
        name: 'Forecast',
        type: 'line',
        data: rows.map((item) => item.forecast ?? null),
        smooth: true,
        connectNulls: false,
        symbolSize: 7,
        lineStyle: { width: 3 },
      },
    ],
  }
}

function formatMonthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00Z`)

  return new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date)
}

function formatAiLineLabel(label: string): string {
  if (/^\d{4}-\d{2}$/.test(label)) {
    const date = new Date(`${label}-01T00:00:00Z`)

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date)
  }

  return label || 'Result'
}

function formatNumber(value: unknown): string {
  if (typeof value !== 'number') {
    return ''
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value)
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

function isAiBarDatum(value: unknown): value is AiBarDatum {
  return (
    value !== null &&
    typeof value === 'object' &&
    'value' in value &&
    typeof value.value === 'number'
  )
}

function isAiLineDatum(value: unknown): value is AiLineDatum {
  if (value === null || typeof value !== 'object') {
    return false
  }

  const candidate = value as AiLineDatum

  return (
    typeof candidate.month === 'string' ||
    typeof candidate.group === 'string' ||
    typeof candidate.historical === 'number' ||
    typeof candidate.forecast === 'number' ||
    typeof candidate.value === 'number'
  )
}

function formatInteger(value: unknown): string {
  return new Intl.NumberFormat('en-US').format(Number(value))
}
