<template>
  <div class="dashboard-shell">
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">LI</div>
          <div>
            <h1>Logistics Intelligence Dashboard</h1>
            <p>Operational KPIs for a read-only logistics dataset</p>
          </div>
        </div>
        <div class="topbar-actions">
          <span class="health-dot" aria-hidden="true"></span>
          <span>{{ isBusy ? 'Refreshing dashboard data' : 'Dataset: logistics_orders' }}</span>
        </div>
      </div>
    </header>

    <main class="dashboard-main">
      <form class="toolbar" aria-label="Dashboard filters" @submit.prevent="applyFilters">
        <div class="field">
          <label for="dateRange">Date range</label>
          <select id="dateRange" v-model="filters.dateRange">
            <option value="all">Full year 2025</option>
            <option value="q1">Q1 2025</option>
            <option value="q2">Q2 2025</option>
            <option value="q3">Q3 2025</option>
            <option value="q4">Q4 2025</option>
          </select>
        </div>

        <div class="field">
          <label for="carrier">Carrier</label>
          <select id="carrier" v-model="filters.carrier" :disabled="isLoadingFilters">
            <option value="all">All carriers</option>
            <option v-for="carrier in filterOptions.carriers" :key="carrier" :value="carrier">
              {{ carrier }}
            </option>
          </select>
        </div>

        <div class="field">
          <label for="region">Region</label>
          <select id="region" v-model="filters.region" :disabled="isLoadingFilters">
            <option value="all">All regions</option>
            <option v-for="region in filterOptions.regions" :key="region" :value="region">
              {{ region }}
            </option>
          </select>
        </div>

        <div class="field">
          <label for="status">Status</label>
          <select id="status" v-model="filters.status" :disabled="isLoadingFilters">
            <option value="all">All statuses</option>
            <option v-for="status in filterOptions.statuses" :key="status" :value="status">
              {{ formatStatusLabel(status) }}
            </option>
          </select>
        </div>

        <div class="field search-field">
          <label for="search">Search</label>
          <input
            id="search"
            v-model="filters.search"
            type="search"
            placeholder="Order, SKU, city, warehouse"
          />
        </div>

        <div class="toolbar-actions">
          <button class="primary-btn" type="submit" :disabled="isBusy">
            {{ isBusy ? 'Applying' : 'Apply' }}
          </button>
          <button class="ghost-btn" type="button" :disabled="isBusy" @click="resetFilters">
            Reset
          </button>
        </div>
      </form>

      <p v-if="errorMessage" class="error-message" role="alert">
        {{ errorMessage }}
      </p>

      <section class="kpi-grid" aria-label="Key performance indicators">
        <article v-for="card in kpiCards" :key="card.label" class="kpi">
          <div class="kpi-top">
            <span>{{ card.label }}</span>
            <span class="kpi-icon" :class="`tone-${card.tone}`">{{ card.icon }}</span>
          </div>
          <div class="kpi-value" :class="{ muted: isLoadingKpis }">
            {{ isLoadingKpis ? '--' : card.value }}
          </div>
          <div class="kpi-note">{{ card.note }}</div>
        </article>
      </section>

      <section class="insights-layout" aria-label="Dashboard insights">
        <section class="analytics-panel" aria-label="Operational dashboard charts">
          <div class="analytics-header">
            <div>
              <h2>Charts</h2>
            </div>
            <div class="chart-legend" aria-hidden="true">
              <span class="legend-item"><span class="swatch swatch-blue"></span>Orders</span>
              <span class="legend-item"><span class="swatch swatch-red"></span>Delayed</span>
              <span class="legend-item"><span class="swatch swatch-green"></span>Delivered</span>
            </div>
          </div>

          <div v-loading="isLoadingCharts" class="analytics-body">
            <article class="chart-box">
              <div class="chart-title">
                <span>Order Volume Over Time</span>
                <span>Monthly</span>
              </div>
              <VChart
                v-if="charts.monthlyOrderVolume.length > 0"
                class="chart-stage"
                :option="orderVolumeChartOption"
                autoresize
              />
              <div v-else class="chart-empty">No order volume data</div>
            </article>

            <article class="chart-box">
              <div class="chart-title">
                <span>Delivery Performance</span>
                <span>Status mix</span>
              </div>
              <VChart
                v-if="charts.statusMix.length > 0"
                class="chart-stage"
                :option="statusMixChartOption"
                autoresize
              />
              <div v-else class="chart-empty">No status mix data</div>
            </article>
          </div>
        </section>

        <aside class="ai-query-panel" aria-label="AI Query">
          <div class="ai-query-header">
            <div>
              <h2>AI Query</h2>
              <p>Natural language is routed to validated analytical tools.</p>
            </div>
          </div>

          <form class="ai-query-form" @submit.prevent="runAiQuery">
            <label for="aiQuestion">Question</label>
            <textarea
              id="aiQuestion"
              v-model="aiQuestion"
              rows="2"
              placeholder="Ask about delayed orders, carriers, or demand forecasts"
              :disabled="isRunningAiQuery"
            ></textarea>

            <div class="ai-query-actions">
              <button
                v-for="prompt in aiShortcutPrompts"
                :key="prompt.label"
                class="prompt-chip"
                type="button"
                :disabled="isRunningAiQuery"
                @click="runShortcutPrompt(prompt.question)"
              >
                {{ prompt.label }}
              </button>
            </div>

            <button class="primary-btn ai-run-btn" type="submit" :disabled="isRunningAiQuery">
              {{ isRunningAiQuery ? 'Running' : 'Run' }}
            </button>
          </form>

          <p v-if="aiQueryError" class="ai-query-error" role="alert">
            {{ aiQueryError }}
          </p>

          <div v-if="aiResult" class="ai-query-result">
            <p class="ai-answer">{{ aiResult.explanation }}</p>

            <div v-if="aiKpiValue" class="ai-kpi-result">
              <span>Computed result</span>
              <strong>{{ aiKpiValue }}</strong>
            </div>
            <VChart
              v-else-if="aiVisualizationChartOption"
              class="ai-query-chart"
              :option="aiVisualizationChartOption"
              autoresize
            />
            <pre v-else class="ai-json-result">{{ formatJson(aiResult.visualization.data) }}</pre>
          </div>
          <div v-else class="ai-query-empty">Run a question to see the answer and chart.</div>
        </aside>
      </section>

      <section class="orders-panel" aria-label="Filtered logistics orders">
        <div class="orders-header">
          <div>
            <h2>Orders</h2>
            <p>{{ formatInteger(ordersPagination.total) }} matching records</p>
          </div>
          <span v-if="ordersPagination.totalPages > 0">
            Page {{ ordersPagination.page }} / {{ ordersPagination.totalPages }}
          </span>
        </div>

        <el-table
          v-loading="isLoadingOrders"
          :data="orders"
          class="orders-table"
          empty-text="No orders found"
          stripe
        >
          <el-table-column prop="orderId" label="Order ID" min-width="120" />
          <el-table-column prop="orderDate" label="Order Date" min-width="120" />
          <el-table-column prop="carrier" label="Carrier" min-width="110" />
          <el-table-column label="Route" min-width="210">
            <template #default="{ row }">
              {{ row.originCity }} -> {{ row.destinationCity }}
            </template>
          </el-table-column>
          <el-table-column label="Status" min-width="120">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.status)" effect="light" round>
                {{ formatStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="sku" label="SKU" min-width="130" />
          <el-table-column prop="quantity" label="Qty" min-width="80" align="right" />
          <el-table-column label="Value" min-width="110" align="right">
            <template #default="{ row }">
              {{ formatCurrency(row.orderValueUsd) }}
            </template>
          </el-table-column>
          <el-table-column prop="warehouse" label="Warehouse" min-width="120" />
        </el-table>

        <div class="orders-pagination">
          <el-pagination
            v-model:current-page="ordersPagination.page"
            v-model:page-size="ordersPagination.pageSize"
            :disabled="isLoadingOrders"
            :page-sizes="[10, 20, 50, 100]"
            :total="ordersPagination.total"
            background
            layout="total, sizes, prev, pager, next"
            @current-change="handleOrdersPageChange"
            @size-change="handleOrdersPageSizeChange"
          />
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import axios from 'axios'
import { use } from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, onMounted, reactive, ref } from 'vue'
import VChart from 'vue-echarts'
import {
  buildAiVisualizationChartOption,
  buildOrderVolumeChartOption,
  buildStatusMixChartOption,
  buildKpiQuery,
  formatAverageDeliveryTime,
  formatOnTimeRate,
} from '@/utils/logistics-dashboard'

use([BarChart, LineChart, GridComponent, TooltipComponent, CanvasRenderer])

interface LogisticsFilters {
  carriers: string[]
  regions: string[]
  statuses: string[]
}

interface LogisticsKpis {
  totalOrders: number
  deliveredOrders: number
  delayedOrders: number
  onTimeDeliveryRate: number
  averageDeliveryTimeDays: number | null
}

interface LogisticsMonthlyOrderVolume {
  month: string
  orders: number
}

interface LogisticsStatusMix {
  status: string
  label: string
  count: number
  percentage: number
}

interface LogisticsCharts {
  monthlyOrderVolume: LogisticsMonthlyOrderVolume[]
  statusMix: LogisticsStatusMix[]
}

interface LogisticsOrderItem {
  orderId: string
  clientId: string
  orderDate: string
  deliveryDate: string
  carrier: string
  originCity: string
  destinationCity: string
  status: string
  sku: string
  productCategory: string
  quantity: number
  unitPriceUsd: number
  orderValueUsd: number
  isPromo: boolean
  promoDiscountPct: number
  region: string
  warehouse: string
}

interface LogisticsOrdersResponse {
  items: LogisticsOrderItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

interface AiOrchestrationResponse {
  question: string
  selectedTool: 'forecast_category_demand' | 'query_logistics_analytics'
  toolInput: Record<string, unknown>
  result: unknown
  explanation: string
  visualization: {
    type: 'line' | 'bar' | 'table' | 'kpi'
    data: unknown
  }
}

const emptyFilters: LogisticsFilters = {
  carriers: [],
  regions: [],
  statuses: [],
}

const emptyKpis: LogisticsKpis = {
  totalOrders: 0,
  deliveredOrders: 0,
  delayedOrders: 0,
  onTimeDeliveryRate: 0,
  averageDeliveryTimeDays: null,
}

const emptyCharts: LogisticsCharts = {
  monthlyOrderVolume: [],
  statusMix: [],
}

const filters = reactive({
  dateRange: 'all',
  carrier: 'all',
  region: 'all',
  status: 'all',
  search: '',
})
const filterOptions = ref<LogisticsFilters>(emptyFilters)
const kpis = ref<LogisticsKpis>(emptyKpis)
const charts = ref<LogisticsCharts>(emptyCharts)
const orders = ref<LogisticsOrderItem[]>([])
const ordersPagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
})
const isLoadingFilters = ref(false)
const isLoadingKpis = ref(false)
const isLoadingCharts = ref(false)
const isLoadingOrders = ref(false)
const errorMessage = ref('')
const aiQuestion = ref('Which carrier has the highest delay rate?')
const aiResult = ref<AiOrchestrationResponse | null>(null)
const isRunningAiQuery = ref(false)
const aiQueryError = ref('')

const aiShortcutPrompts = [
  {
    label: 'Delayed by week',
    question: 'Show delayed orders by week in Q4',
  },
  {
    label: 'Carrier delay rate',
    question: 'Which carrier has the highest delay rate?',
  },
  {
    label: 'Delayed in Q4',
    question: 'How many delayed orders were there in Q4?',
  },
]

const isBusy = computed(
  () =>
    isLoadingFilters.value ||
    isLoadingKpis.value ||
    isLoadingCharts.value ||
    isLoadingOrders.value,
)

const kpiCards = computed(() => [
  {
    label: 'Total Orders',
    icon: '#',
    value: formatInteger(kpis.value.totalOrders),
    note: 'Counted by order_id',
    tone: 'neutral',
  },
  {
    label: 'Delivered Orders',
    icon: 'OK',
    value: formatInteger(kpis.value.deliveredOrders),
    note: 'status = delivered',
    tone: 'green',
  },
  {
    label: 'Delayed Orders',
    icon: '!',
    value: formatInteger(kpis.value.delayedOrders),
    note: 'status = delayed',
    tone: 'red',
  },
  {
    label: 'On-time Delivery Rate',
    icon: '%',
    value: formatOnTimeRate(kpis.value.onTimeDeliveryRate),
    note: 'delivered / completed outcomes',
    tone: 'blue',
  },
  {
    label: 'Average Delivery Time',
    icon: 'D',
    value: formatAverageDeliveryTime(kpis.value.averageDeliveryTimeDays),
    note: 'delivery_date present only',
    tone: 'teal',
  },
])

const orderVolumeChartOption = computed(() =>
  buildOrderVolumeChartOption(charts.value.monthlyOrderVolume),
)

const statusMixChartOption = computed(() => buildStatusMixChartOption(charts.value.statusMix))

const aiVisualizationChartOption = computed(() => {
  if (!aiResult.value) {
    return null
  }

  return buildAiVisualizationChartOption(aiResult.value.visualization)
})

const aiKpiValue = computed(() => {
  if (!aiResult.value || aiResult.value.visualization.type !== 'kpi') {
    return ''
  }

  const value = getVisualizationValue(aiResult.value.visualization.data)

  if (value === null) {
    return ''
  }

  return formatAiMetricValue(value, aiResult.value.toolInput.metric)
})

onMounted(async () => {
  await Promise.all([loadFilters(), refreshDashboard()])
})

async function loadFilters() {
  isLoadingFilters.value = true

  try {
    const response = await axios.get<LogisticsFilters>('/api/dashbord/logistics/filters')
    filterOptions.value = response.data
  } catch (error) {
    setError(error)
  } finally {
    isLoadingFilters.value = false
  }
}

async function loadKpis() {
  isLoadingKpis.value = true

  try {
    const response = await axios.get<LogisticsKpis>('/api/dashbord/logistics/kpis', {
      params: buildLogisticsParams(),
    })
    kpis.value = response.data
  } catch (error) {
    setError(error)
    kpis.value = emptyKpis
  } finally {
    isLoadingKpis.value = false
  }
}

async function loadCharts() {
  isLoadingCharts.value = true

  try {
    const response = await axios.get<LogisticsCharts>('/api/dashbord/logistics/charts', {
      params: buildLogisticsParams(),
    })
    charts.value = response.data
  } catch (error) {
    setError(error)
    charts.value = emptyCharts
  } finally {
    isLoadingCharts.value = false
  }
}

async function loadOrders() {
  isLoadingOrders.value = true

  try {
    const response = await axios.get<LogisticsOrdersResponse>('/api/dashbord/logistics/orders', {
      params: buildOrdersParams(),
    })
    const result = response.data
    orders.value = result.items
    ordersPagination.page = result.pagination.page
    ordersPagination.pageSize = result.pagination.pageSize
    ordersPagination.total = result.pagination.total
    ordersPagination.totalPages = result.pagination.totalPages
  } catch (error) {
    setError(error)
    orders.value = []
    ordersPagination.total = 0
    ordersPagination.totalPages = 0
  } finally {
    isLoadingOrders.value = false
  }
}

async function refreshDashboard() {
  errorMessage.value = ''
  await Promise.all([loadKpis(), loadCharts(), loadOrders()])
}

async function runAiQuery() {
  const question = aiQuestion.value.trim()

  if (!question) {
    aiQueryError.value = 'Enter a question before running AI Query.'
    return
  }

  isRunningAiQuery.value = true
  aiQueryError.value = ''

  try {
    const response = await axios.post<AiOrchestrationResponse>('/api/ai/orchestrate', {
      question,
    })
    aiResult.value = response.data
  } catch (error) {
    aiQueryError.value = getAiQueryErrorMessage(error)
  } finally {
    isRunningAiQuery.value = false
  }
}

function runShortcutPrompt(question: string) {
  aiQuestion.value = question
  void runAiQuery()
}

function applyFilters() {
  ordersPagination.page = 1
  void refreshDashboard()
}

function resetFilters() {
  filters.dateRange = 'all'
  filters.carrier = 'all'
  filters.region = 'all'
  filters.status = 'all'
  filters.search = ''
  ordersPagination.page = 1
  void refreshDashboard()
}

function handleOrdersPageChange(page: number) {
  ordersPagination.page = page
  errorMessage.value = ''
  void loadOrders()
}

function handleOrdersPageSizeChange(pageSize: number) {
  ordersPagination.page = 1
  ordersPagination.pageSize = pageSize
  errorMessage.value = ''
  void loadOrders()
}

function buildLogisticsParams() {
  return new URLSearchParams(buildKpiQuery(filters))
}

function buildOrdersParams() {
  const params = new URLSearchParams(buildKpiQuery(filters))

  params.set('page', String(ordersPagination.page))
  params.set('pageSize', String(ordersPagination.pageSize))

  return params
}

function setError(error: unknown) {
  errorMessage.value = error instanceof Error ? error.message : 'Dashboard request failed.'
}

function getAiQueryErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const responseMessage = getResponseMessage(error.response?.data)

    if (status === 429) {
      return responseMessage || '免费次数已用完'
    }

    if (status === 503) {
      return responseMessage || 'Qwen API key is not configured.'
    }

    return responseMessage || 'AI Query request failed.'
  }

  return error instanceof Error ? error.message : 'AI Query request failed.'
}

function getResponseMessage(data: unknown) {
  if (data !== null && typeof data === 'object' && 'message' in data) {
    const message = data.message

    if (typeof message === 'string') {
      return message
    }
  }

  return ''
}

function getVisualizationValue(data: unknown) {
  if (data !== null && typeof data === 'object' && 'value' in data) {
    const value = data.value

    if (typeof value === 'number') {
      return value
    }
  }

  return null
}

function formatAiMetricValue(value: number, metric: unknown) {
  if (metric === 'delay_rate' || metric === 'on_time_delivery_rate') {
    return formatOnTimeRate(value)
  }

  if (metric === 'average_delivery_time_days') {
    return formatAverageDeliveryTime(value)
  }

  if (metric === 'order_value') {
    return formatCurrency(value)
  }

  return formatNumber(value)
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function formatInteger(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value)
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ')
}

function getStatusTagType(status: string) {
  if (status === 'delivered') {
    return 'success'
  }

  if (status === 'delayed') {
    return 'warning'
  }

  return 'info'
}
</script>
