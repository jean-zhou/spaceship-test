import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  LogisticsAnalyticsGroupBy,
  LogisticsAnalyticsMetric,
  LogisticsAnalyticsQueryType,
} from '../../dashbord/logistics-analytics.service.js';

export class QueryLogisticsAnalyticsFiltersDto {
  @ApiProperty({ example: 'all' })
  dateRange!: string;

  @ApiPropertyOptional()
  carrier?: string;

  @ApiPropertyOptional()
  region?: string;

  @ApiPropertyOptional()
  status?: string;

  @ApiPropertyOptional()
  search?: string;
}

export class QueryLogisticsAnalyticsRowDto {
  @ApiPropertyOptional({ example: 'Boreal' })
  group?: string;

  @ApiProperty({ example: 66.7 })
  value!: number;

  @ApiPropertyOptional({ example: 3 })
  totalOrders?: number;

  @ApiPropertyOptional({ example: 2 })
  delayedOrders?: number;

  @ApiPropertyOptional({ example: 1 })
  deliveredOrders?: number;

  @ApiPropertyOptional({ example: 66.7 })
  rate?: number;
}

export class QueryLogisticsAnalyticsSummaryDto {
  @ApiProperty({
    example: 'Top carrier by delay rate is Boreal at 66.7%.',
  })
  text!: string;
}

export class QueryLogisticsAnalyticsMethodologyDto {
  @ApiProperty({ example: 'order_date' })
  dateField!: string;

  @ApiProperty({ example: '2025-01-01 through 2025-12-31' })
  defaultDateRange!: string;

  @ApiProperty({ example: 'Orders with status = delayed.' })
  delayDefinition!: string;
}

export class QueryLogisticsAnalyticsResponseDto {
  @ApiProperty({ enum: ['aggregate', 'ranking', 'time_series'] })
  questionType!: LogisticsAnalyticsQueryType;

  @ApiProperty({
    enum: [
      'order_count',
      'delayed_orders',
      'delay_rate',
      'on_time_delivery_rate',
      'average_delivery_time_days',
      'order_value',
    ],
  })
  metric!: LogisticsAnalyticsMetric;

  @ApiPropertyOptional({
    enum: [
      'carrier',
      'region',
      'status',
      'product_category',
      'warehouse',
      'week',
      'month',
    ],
  })
  groupBy?: LogisticsAnalyticsGroupBy;

  @ApiProperty({ type: QueryLogisticsAnalyticsFiltersDto })
  filters!: QueryLogisticsAnalyticsFiltersDto;

  @ApiProperty({ type: [QueryLogisticsAnalyticsRowDto] })
  rows!: QueryLogisticsAnalyticsRowDto[];

  @ApiProperty({ type: QueryLogisticsAnalyticsSummaryDto })
  summary!: QueryLogisticsAnalyticsSummaryDto;

  @ApiProperty({ type: QueryLogisticsAnalyticsMethodologyDto })
  methodology!: QueryLogisticsAnalyticsMethodologyDto;
}
