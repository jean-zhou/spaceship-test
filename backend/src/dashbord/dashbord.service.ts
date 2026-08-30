import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDashbordDto } from './dto/create-dashbord.dto.js';
import type { LogisticsFiltersResponseDto } from './dto/logistics-filters.response.dto.js';
import type {
  LogisticsOrdersQueryDto,
  LogisticsQueryDto,
} from './dto/logistics-query.dto.js';
import type { LogisticsOrdersResponseDto } from './dto/logistics-orders.response.dto.js';
import { LogisticsOrderItemDto } from './dto/logistics-orders.response.dto.js';
import type { LogisticsChartsResponseDto } from './dto/logistics-charts.response.dto.js';
import type { LogisticsKpisResponseDto } from './dto/logistics-kpis.response.dto.js';
import { UpdateDashbordDto } from './dto/update-dashbord.dto.js';
import { LogisticsOrder } from './entities/logistics-order.entity.js';
import {
  getLogisticsMonthsForRange,
  LogisticsAnalyticsService,
} from './logistics-analytics.service.js';

interface RawLogisticsKpis {
  totalOrders: number | string | null;
  deliveredOrders: number | string | null;
  delayedOrders: number | string | null;
  averageDeliveryTimeDays: number | string | null;
}

interface RawMonthlyOrderVolume {
  month: string;
  orders: number | string | null;
}

interface RawStatusMix {
  status: string;
  count: number | string | null;
}

@Injectable()
export class DashbordService {
  constructor(
    @InjectRepository(LogisticsOrder)
    private readonly logisticsOrders: Repository<LogisticsOrder>,
    private readonly logisticsAnalytics: LogisticsAnalyticsService,
  ) {}

  create(_createDashbordDto: CreateDashbordDto) {
    return 'This action adds a new dashbord';
  }

  findAll() {
    return `This action returns all dashbord`;
  }

  findOne(id: number) {
    return `This action returns a #${id} dashbord`;
  }

  update(id: number, _updateDashbordDto: UpdateDashbordDto) {
    return `This action updates a #${id} dashbord`;
  }

  remove(id: number) {
    return `This action removes a #${id} dashbord`;
  }

  async getLogisticsFilters(): Promise<LogisticsFiltersResponseDto> {
    const [carriers, regions, statuses] = await Promise.all([
      this.getDistinctValues('carrier'),
      this.getDistinctValues('region'),
      this.getDistinctValues('status'),
    ]);

    return { carriers, regions, statuses };
  }

  async getLogisticsKpis(
    query: LogisticsQueryDto,
  ): Promise<LogisticsKpisResponseDto> {
    const builder = this.logisticsAnalytics
      .applyLogisticsFilters(
        this.logisticsOrders.createQueryBuilder('orders'),
        query,
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
      );

    const raw = await builder.getRawOne<RawLogisticsKpis>();
    const totalOrders = toNumber(raw?.totalOrders);
    const deliveredOrders = toNumber(raw?.deliveredOrders);
    const delayedOrders = toNumber(raw?.delayedOrders);
    const completedOutcomes = deliveredOrders + delayedOrders;
    const averageDeliveryTimeDays =
      raw?.averageDeliveryTimeDays === null ||
      raw?.averageDeliveryTimeDays === undefined
        ? null
        : roundMetric(toNumber(raw.averageDeliveryTimeDays), 2);

    return {
      totalOrders,
      deliveredOrders,
      delayedOrders,
      onTimeDeliveryRate:
        completedOutcomes === 0
          ? 0
          : roundMetric((deliveredOrders / completedOutcomes) * 100, 1),
      averageDeliveryTimeDays,
    };
  }

  async getLogisticsCharts(
    query: LogisticsQueryDto,
  ): Promise<LogisticsChartsResponseDto> {
    const [monthlyRows, statusRows] = await Promise.all([
      this.logisticsAnalytics
        .applyLogisticsFilters(
          this.logisticsOrders.createQueryBuilder('orders'),
          query,
        )
        .select("strftime('%Y-%m', orders.order_date)", 'month')
        .addSelect('COUNT(*)', 'orders')
        .groupBy('month')
        .orderBy('month', 'ASC')
        .getRawMany<RawMonthlyOrderVolume>(),
      this.logisticsAnalytics
        .applyLogisticsFilters(
          this.logisticsOrders.createQueryBuilder('orders'),
          query,
        )
        .select('orders.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('orders.status')
        .orderBy('count', 'DESC')
        .addOrderBy('orders.status', 'ASC')
        .getRawMany<RawStatusMix>(),
    ]);

    const monthlyCounts = new Map(
      monthlyRows.map((row) => [row.month, toNumber(row.orders)]),
    );
    const totalStatusCount = statusRows.reduce(
      (sum, row) => sum + toNumber(row.count),
      0,
    );

    return {
      monthlyOrderVolume: getLogisticsMonthsForRange(query.dateRange).map(
        (month) => ({
          month,
          orders: monthlyCounts.get(month) ?? 0,
        }),
      ),
      statusMix: statusRows.map((row) => {
        const count = toNumber(row.count);

        return {
          status: row.status,
          label: formatStatusLabel(row.status),
          count,
          percentage:
            totalStatusCount === 0
              ? 0
              : roundMetric((count / totalStatusCount) * 100, 1),
        };
      }),
    };
  }

  async getLogisticsOrders(
    query: LogisticsOrdersQueryDto,
  ): Promise<LogisticsOrdersResponseDto> {
    const { page, pageSize } = query;
    const [orders, total] = await this.logisticsAnalytics
      .applyLogisticsFilters(
        this.logisticsOrders.createQueryBuilder('orders'),
        query,
      )
      .orderBy('orders.order_date', 'DESC')
      .addOrderBy('orders.order_id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items: orders.map((order) => new LogisticsOrderItemDto(order)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }

  private async getDistinctValues(
    column: 'carrier' | 'region' | 'status',
  ): Promise<string[]> {
    const rows = await this.logisticsOrders
      .createQueryBuilder('orders')
      .select(`orders.${column}`, 'value')
      .distinct(true)
      .where(`orders.${column} <> ''`)
      .orderBy(`orders.${column}`, 'ASC')
      .getRawMany<{ value: string }>();

    return rows.map((row) => row.value);
  }
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

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}
