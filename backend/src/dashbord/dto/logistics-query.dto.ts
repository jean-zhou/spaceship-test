import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export type LogisticsDateRange = 'all' | 'q1' | 'q2' | 'q3' | 'q4';

export class LogisticsQueryDto {
  @ApiPropertyOptional({
    enum: ['all', 'q1', 'q2', 'q3', 'q4'],
    description: 'Order date range.',
  })
  @IsOptional()
  @IsIn(['all', 'q1', 'q2', 'q3', 'q4'])
  dateRange?: LogisticsDateRange | string;

  @ApiPropertyOptional({ description: 'Carrier name.' })
  @IsOptional()
  @IsString()
  carrier?: string;

  @ApiPropertyOptional({ description: 'Order region.' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ description: 'Order status.' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Search text matched against order, client, carrier, city, SKU, category, and warehouse fields.',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class LogisticsOrdersQueryDto extends LogisticsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, description: 'Page number.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    default: 10,
    minimum: 1,
    description: 'Number of records per page.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize = 10;
}
