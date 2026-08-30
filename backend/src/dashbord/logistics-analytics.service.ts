import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import type { LogisticsQueryDto } from './dto/logistics-query.dto.js';
import { LogisticsOrder } from './entities/logistics-order.entity.js';

export type LogisticsAnalyticsQueryType =
  'aggregate' | 'ranking' | 'time_series';
export type LogisticsAnalyticsMetric =
  | 'order_count'
  | 'delayed_orders'
  | 'delay_rate'
  | 'on_time_delivery_rate'
  | 'average_delivery_time_days'
  | 'order_value';
export type LogisticsAnalyticsGroupBy =
  | 'carrier'
  | 'region'
  | 'status'
  | 'product_category'
  | 'warehouse'
  | 'week'
  | 'month';
export type LogisticsAnalyticsSortBy = 'metric' | 'group';
export type LogisticsAnalyticsSortDirection = 'asc' | 'desc';

export interface LogisticsAnalyticsRequest extends LogisticsQueryDto {
  queryType: LogisticsAnalyticsQueryType;
  metric: LogisticsAnalyticsMetric;
  groupBy?: LogisticsAnalyticsGroupBy;
  sortBy?: LogisticsAnalyticsSortBy;
  sortDirection?: LogisticsAnalyticsSortDirection;
  limit?: number;
}

export interface LogisticsAnalyticsRow {
  group?: string;
  value: number;
  totalOrders?: number;
  delayedOrders?: number;
  deliveredOrders?: number;
  rate?: number;
}

export interface LogisticsAnalyticsResponse {
  questionType: LogisticsAnalyticsQueryType;
  metric: LogisticsAnalyticsMetric;
  groupBy?: LogisticsAnalyticsGroupBy;
  filters: {
    dateRange: string;
    carrier?: string;
    region?: string;
    status?: string;
    search?: string;
  };
  rows: LogisticsAnalyticsRow[];
  summary: {
    text: string;
  };
  methodology: {
    dateField: string;
    defaultDateRange: string;
    delayDefinition: string;
  };
}

interface RawAnalyticsRow {
  groupValue?: string | null;
  totalOrders: number | string | null;
  deliveredOrders: number | string | null;
  delayedOrders: number | string | null;
  averageDeliveryTimeDays: number | string | null;
  orderValue: number | string | null;
}

@Injectable()
export class LogisticsAnalyticsService {
  constructor(
    @InjectRepository(LogisticsOrder)
    private readonly logisticsOrders: Repository<LogisticsOrder>,
  ) {}

  applyLogisticsFilters(
    builder: SelectQueryBuilder<LogisticsOrder>,
    query: LogisticsQueryDto,
  ): SelectQueryBuilder<LogisticsOrder> {
    const range = getDateRange(query.dateRange);

    builder.andWhere('orders.order_date BETWEEN :startDate AND :endDate', {
      startDate: range.startDate,
      endDate: range.endDate,
    });

    this.applyExactFilter(builder, 'carrier', query.carrier);
    this.applyExactFilter(builder, 'region', query.region);
    this.applyExactFilter(builder, 'status', query.status);

    if (query.search) {
      builder.andWhere(
        `
          (
            LOWER(orders.order_id) LIKE :search OR
            LOWER(orders.client_id) LIKE :search OR
            LOWER(orders.carrier) LIKE :search OR
            LOWER(orders.origin_city) LIKE :search OR
            LOWER(orders.destination_city) LIKE :search OR
            LOWER(orders.sku) LIKE :search OR
            LOWER(orders.product_category) LIKE :search OR
            LOWER(orders.warehouse) LIKE :search
          )
        `,
        { search: `%${query.search.toLowerCase()}%` },
      );
    }

    return builder;
  }

  async query(
    request: LogisticsAnalyticsRequest,
  ): Promise<LogisticsAnalyticsResponse> {
    const groupBy = request.groupBy;
    const groupExpression = groupBy ? getGroupExpression(groupBy) : undefined;
    const builder = this.applyLogisticsFilters(
      this.logisticsOrders.createQueryBuilder('orders'),
      request,
    )
      .select('COUNT(*)', 'totalOrders')
      .addSelect(
        "SUM(CASE WHEN orders.status = 'delivered' THEN 1 ELSE 0 END)",
        'deliveredOrders',
      )
      .addSelect(
        "SUM(CASE WHEN orders.status = 'delayed' THEN 1 ELSE 0 END)",
        'delayedOrders',
      )
      .addSelect(
        `
          AVG(
            CASE
              WHEN orders.delivery_date <> ''
              THEN julianday(orders.delivery_date) - julianday(orders.order_date)
            END
          )
        `,
        'averageDeliveryTimeDays',
      )
      .addSelect('SUM(orders.order_value_usd)', 'orderValue');

    if (groupExpression) {
      builder.addSelect(groupExpression, 'groupValue').groupBy('groupValue');
    }

    const rawRows = await builder.getRawMany<RawAnalyticsRow>();
    const rows = rawRows
      .map((row) => ({
        row: toAnalyticsRow(row, request.metric, groupBy),
        completedOutcomes:
          toNumber(row.deliveredOrders) + toNumber(row.delayedOrders),
      }))
      .filter(({ row, completedOutcomes }) =>
        shouldIncludeRow(row, request.metric, completedOutcomes),
      )
      .map(({ row }) => row)
      .sort((left, right) =>
        compareRows(
          left,
          right,
          request.sortBy ?? defaultSortBy(request.queryType),
          request.sortDirection ?? defaultSortDirection(request.queryType),
        ),
      )
      .slice(0, request.limit ?? defaultLimit(request.queryType));

    return {
      questionType: request.queryType,
      metric: request.metric,
      groupBy,
      filters: buildFilters(request),
      rows,
      summary: {
        text: buildSummary(request, rows),
      },
      methodology: {
        dateField: 'order_date',
        defaultDateRange: '2025-01-01 through 2025-12-31',
        delayDefinition: 'Orders with status = delayed.',
      },
    };
  }

  private applyExactFilter(
    builder: SelectQueryBuilder<LogisticsOrder>,
    column: 'carrier' | 'region' | 'status',
    value: string | undefined,
  ): void {
    if (!value || value === 'all') {
      return;
    }

    builder.andWhere(`orders.${column} = :${column}`, {
      [column]: value,
    });
  }
}

export function getLogisticsMonthsForRange(
  dateRange: string | undefined,
): string[] {
  const { startDate, endDate } = getDateRange(dateRange);
  const months: string[] = [];
  const startMonth = Number(startDate.slice(5, 7));
  const endMonth = Number(endDate.slice(5, 7));

  for (let month = startMonth; month <= endMonth; month += 1) {
    months.push(`2025-${String(month).padStart(2, '0')}`);
  }

  return months;
}

function getDateRange(dateRange: string | undefined): {
  startDate: string;
  endDate: string;
} {
  const fullYear = { startDate: '2025-01-01', endDate: '2025-12-31' };
  const ranges: Record<string, { startDate: string; endDate: string }> = {
    all: fullYear,
    q1: { startDate: '2025-01-01', endDate: '2025-03-31' },
    q2: { startDate: '2025-04-01', endDate: '2025-06-30' },
    q3: { startDate: '2025-07-01', endDate: '2025-09-30' },
    q4: { startDate: '2025-10-01', endDate: '2025-12-31' },
  };

  return dateRange ? (ranges[dateRange] ?? fullYear) : fullYear;
}

function getGroupExpression(groupBy: LogisticsAnalyticsGroupBy): string {
  const groups: Record<LogisticsAnalyticsGroupBy, string> = {
    carrier: 'orders.carrier',
    region: 'orders.region',
    status: 'orders.status',
    product_category: 'orders.product_category',
    warehouse: 'orders.warehouse',
    week: "strftime('%Y-W%W', orders.order_date)",
    month: "strftime('%Y-%m', orders.order_date)",
  };

  return groups[groupBy];
}

function toAnalyticsRow(
  row: RawAnalyticsRow,
  metric: LogisticsAnalyticsMetric,
  groupBy: LogisticsAnalyticsGroupBy | undefined,
): LogisticsAnalyticsRow {
  const totalOrders = toNumber(row.totalOrders);
  const deliveredOrders = toNumber(row.deliveredOrders);
  const delayedOrders = toNumber(row.delayedOrders);
  const completedOutcomes = deliveredOrders + delayedOrders;
  const rate =
    completedOutcomes === 0
      ? 0
      : roundMetric((delayedOrders / completedOutcomes) * 100, 1);
  const value = getMetricValue(row, metric, {
    totalOrders,
    deliveredOrders,
    delayedOrders,
    rate,
  });
  const analyticsRow: LogisticsAnalyticsRow = {
    value,
    delayedOrders,
  };

  if (metric !== 'delayed_orders') {
    analyticsRow.totalOrders = totalOrders;
  }

  if (groupBy) {
    analyticsRow.group = row.groupValue ?? '';
  }

  if (metric === 'delay_rate') {
    analyticsRow.rate = value;
  }

  if (metric === 'on_time_delivery_rate') {
    analyticsRow.deliveredOrders = deliveredOrders;
    analyticsRow.rate = value;
  }

  return analyticsRow;
}

function getMetricValue(
  row: RawAnalyticsRow,
  metric: LogisticsAnalyticsMetric,
  counts: {
    totalOrders: number;
    deliveredOrders: number;
    delayedOrders: number;
    rate: number;
  },
): number {
  const completedOutcomes = counts.deliveredOrders + counts.delayedOrders;

  switch (metric) {
    case 'order_count':
      return counts.totalOrders;
    case 'delayed_orders':
      return counts.delayedOrders;
    case 'delay_rate':
      return counts.rate;
    case 'on_time_delivery_rate':
      return completedOutcomes === 0
        ? 0
        : roundMetric((counts.deliveredOrders / completedOutcomes) * 100, 1);
    case 'average_delivery_time_days':
      return row.averageDeliveryTimeDays === null ||
        row.averageDeliveryTimeDays === undefined
        ? 0
        : roundMetric(toNumber(row.averageDeliveryTimeDays), 2);
    case 'order_value':
      return roundMetric(toNumber(row.orderValue), 2);
  }
}

function shouldIncludeRow(
  row: LogisticsAnalyticsRow,
  metric: LogisticsAnalyticsMetric,
  completedOutcomes: number,
): boolean {
  if (metric === 'delay_rate' || metric === 'on_time_delivery_rate') {
    return completedOutcomes > 0;
  }

  return row.value > 0;
}

function compareRows(
  left: LogisticsAnalyticsRow,
  right: LogisticsAnalyticsRow,
  sortBy: LogisticsAnalyticsSortBy,
  direction: LogisticsAnalyticsSortDirection,
): number {
  const directionMultiplier = direction === 'asc' ? 1 : -1;

  if (sortBy === 'group') {
    return (
      directionMultiplier * (left.group ?? '').localeCompare(right.group ?? '')
    );
  }

  if (left.value !== right.value) {
    return directionMultiplier * (left.value - right.value);
  }

  return (left.group ?? '').localeCompare(right.group ?? '');
}

function defaultSortDirection(
  queryType: LogisticsAnalyticsQueryType,
): LogisticsAnalyticsSortDirection {
  return queryType === 'time_series' ? 'asc' : 'desc';
}

function defaultSortBy(
  queryType: LogisticsAnalyticsQueryType,
): LogisticsAnalyticsSortBy {
  return queryType === 'time_series' ? 'group' : 'metric';
}

function defaultLimit(queryType: LogisticsAnalyticsQueryType): number {
  return queryType === 'time_series' ? Number.POSITIVE_INFINITY : 10;
}

function buildFilters(request: LogisticsAnalyticsRequest) {
  return {
    dateRange: request.dateRange ?? 'all',
    ...(request.carrier ? { carrier: request.carrier } : {}),
    ...(request.region ? { region: request.region } : {}),
    ...(request.status ? { status: request.status } : {}),
    ...(request.search ? { search: request.search } : {}),
  };
}

function buildSummary(
  request: LogisticsAnalyticsRequest,
  rows: LogisticsAnalyticsRow[],
): string {
  if (
    request.queryType === 'time_series' &&
    request.metric === 'delayed_orders' &&
    request.groupBy === 'week'
  ) {
    const delayedOrders = rows.reduce((sum, row) => sum + row.value, 0);

    return `Found ${delayedOrders} delayed orders across ${rows.length} week groups.`;
  }

  if (
    request.queryType === 'ranking' &&
    request.metric === 'delay_rate' &&
    request.groupBy === 'carrier' &&
    rows[0]
  ) {
    const rankLabel = request.sortDirection === 'asc' ? 'Lowest' : 'Top';

    return `${rankLabel} carrier by delay rate is ${rows[0].group} at ${rows[0].value}%.`;
  }

  return `Returned ${rows.length} ${request.metric} analytics rows.`;
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

function roundMetric(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}
