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
import { computed, onMounted, reactive, ref } from 'vue'
import {
  buildKpiQuery,
  formatAverageDeliveryTime,
  formatOnTimeRate,
} from '@/lib/logistics-dashboard'

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

const filters = reactive({
  dateRange: 'all',
  carrier: 'all',
  region: 'all',
  status: 'all',
  search: '',
})
const filterOptions = ref<LogisticsFilters>(emptyFilters)
const kpis = ref<LogisticsKpis>(emptyKpis)
const orders = ref<LogisticsOrderItem[]>([])
const ordersPagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
})
const isLoadingFilters = ref(false)
const isLoadingKpis = ref(false)
const isLoadingOrders = ref(false)
const errorMessage = ref('')

const isBusy = computed(
  () => isLoadingFilters.value || isLoadingKpis.value || isLoadingOrders.value,
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
  await Promise.all([loadKpis(), loadOrders()])
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
