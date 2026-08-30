import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type {
  LogisticsAnalyticsGroupBy,
  LogisticsAnalyticsMetric,
  LogisticsAnalyticsQueryType,
  LogisticsAnalyticsSortBy,
  LogisticsAnalyticsSortDirection,
} from '../../dashbord/logistics-analytics.service.js';
import type { LogisticsDateRange } from '../../dashbord/dto/logistics-query.dto.js';

const queryTypes = ['aggregate', 'ranking', 'time_series'] as const;
const metrics = [
  'order_count',
  'delayed_orders',
  'delay_rate',
  'on_time_delivery_rate',
  'average_delivery_time_days',
  'order_value',
] as const;
const groupByValues = [
  'carrier',
  'region',
  'status',
  'product_category',
  'warehouse',
  'week',
  'month',
] as const;
const sortByValues = ['metric', 'group'] as const;
const sortDirections = ['asc', 'desc'] as const;
const dateRanges = ['all', 'q1', 'q2', 'q3', 'q4'] as const;

export class QueryLogisticsAnalyticsRequestDto {
  @ApiProperty({
    enum: queryTypes,
    description: 'Analytics query shape to execute.',
  })
  @IsIn(queryTypes)
  queryType!: LogisticsAnalyticsQueryType;

  @ApiProperty({
    enum: metrics,
    description: 'Metric to calculate from logistics orders.',
  })
  @IsIn(metrics)
  metric!: LogisticsAnalyticsMetric;

  @ApiPropertyOptional({
    enum: groupByValues,
    description: 'Optional grouping dimension or time bucket.',
  })
  @IsOptional()
  @IsIn(groupByValues)
  groupBy?: LogisticsAnalyticsGroupBy;

  @ApiPropertyOptional({
    enum: sortByValues,
    description: 'Sort rows by calculated metric or group label.',
  })
  @IsOptional()
  @IsIn(sortByValues)
  sortBy?: LogisticsAnalyticsSortBy;

  @ApiPropertyOptional({
    enum: sortDirections,
    description: 'Sort direction for analytics rows.',
  })
  @IsOptional()
  @IsIn(sortDirections)
  sortDirection?: LogisticsAnalyticsSortDirection;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    description: 'Maximum rows to return.',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    enum: dateRanges,
    default: 'all',
    description: 'Order date range.',
  })
  @IsOptional()
  @IsIn(dateRanges)
  dateRange: LogisticsDateRange = 'all';

  @ApiPropertyOptional({ description: 'Carrier name filter.' })
  @IsOptional()
  @IsString()
  carrier?: string;

  @ApiPropertyOptional({ description: 'Order region filter.' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ description: 'Order status filter.' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description:
      'Search text matched against order, client, carrier, city, SKU, category, and warehouse fields.',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
