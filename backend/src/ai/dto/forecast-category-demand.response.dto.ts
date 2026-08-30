import { ApiProperty } from '@nestjs/swagger';
import type { ForecastMethod } from './forecast-category-demand.request.dto.js';

export class ForecastHistoryWindowDto {
  @ApiProperty({ example: '2025-01' })
  startMonth!: string;

  @ApiProperty({ example: '2025-12' })
  endMonth!: string;

  @ApiProperty({ example: 12 })
  months!: number;
}

export class ForecastDemandPointDto {
  @ApiProperty({ example: '2025-01' })
  month!: string;

  @ApiProperty({ example: 42 })
  quantity!: number;
}

export class ForecastVisualizationPointDto {
  @ApiProperty({ example: '2025-01' })
  month!: string;

  @ApiProperty({ example: 42, nullable: true })
  historical!: number | null;

  @ApiProperty({ example: null, nullable: true })
  forecast!: number | null;
}

export class ForecastVisualizationDto {
  @ApiProperty({ type: [ForecastVisualizationPointDto] })
  series!: ForecastVisualizationPointDto[];
}

export class ForecastInventoryRecommendationDto {
  @ApiProperty({ example: 67 })
  forecastTotal!: number;

  @ApiProperty({ example: 11 })
  safetyStock!: number;

  @ApiProperty({ example: 78 })
  recommendedStock!: number;

  @ApiProperty({ example: 'next 4 months' })
  period!: string;

  @ApiProperty({
    example: 'Recommended stock equals forecast demand plus a 15% safety buffer.',
  })
  rationale!: string;
}

export class ForecastMethodologyDto {
  @ApiProperty({
    example: 'Uses a 3-month moving average over product-category monthly demand.',
  })
  summary!: string;

  @ApiProperty({ type: [String] })
  limitations!: string[];
}

export class ForecastCategoryDemandResponseDto {
  @ApiProperty({ example: 'PAPER' })
  category!: string;

  @ApiProperty({ enum: ['moving_average', 'linear_regression'] })
  method!: ForecastMethod;

  @ApiProperty({ type: ForecastHistoryWindowDto })
  historyWindow!: ForecastHistoryWindowDto;

  @ApiProperty({ type: [ForecastDemandPointDto] })
  historical!: ForecastDemandPointDto[];

  @ApiProperty({ type: [ForecastDemandPointDto] })
  forecast!: ForecastDemandPointDto[];

  @ApiProperty({ type: ForecastVisualizationDto })
  visualization!: ForecastVisualizationDto;

  @ApiProperty({ type: ForecastInventoryRecommendationDto })
  inventoryRecommendation!: ForecastInventoryRecommendationDto;

  @ApiProperty({ type: ForecastMethodologyDto })
  methodology!: ForecastMethodologyDto;
}
