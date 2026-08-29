import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CreateDashbordDto } from './dto/create-dashbord.dto.js';
import type { LogisticsFiltersResponseDto } from './dto/logistics-filters.response.dto.js';
import type {
  LogisticsOrdersQueryDto,
  LogisticsQueryDto,
} from './dto/logistics-query.dto.js';
import type {
  LogisticsOrdersResponseDto,
} from './dto/logistics-orders.response.dto.js';
import { LogisticsOrderItemDto } from './dto/logistics-orders.response.dto.js';
import type { LogisticsKpisResponseDto } from './dto/logistics-kpis.response.dto.js';
import { UpdateDashbordDto } from './dto/update-dashbord.dto.js';
import { LogisticsOrder } from './entities/logistics-order.entity.js';

interface RawLogisticsKpis {
  totalOrders: number | string | null;
  deliveredOrders: number | string | null;
  delayedOrders: number | string | null;
  averageDeliveryTimeDays: number | string | null;
}

@Injectable()
export class DashbordService {
  constructor(
    @InjectRepository(LogisticsOrder)
    private readonly logisticsOrders: Repository<LogisticsOrder>,
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
    const builder = this.applyLogisticsFilters(
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

  async getLogisticsOrders(
    query: LogisticsOrdersQueryDto,
  ): Promise<LogisticsOrdersResponseDto> {
    const { page, pageSize } = query;
    const [orders, total] = await this.applyLogisticsFilters(
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

  private applyLogisticsFilters(
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

function getDateRange(
  dateRange: string | undefined,
): { startDate: string; endDate: string } {
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

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

function roundMetric(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}
