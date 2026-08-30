import { ApiProperty } from '@nestjs/swagger';
import { ForecastCategoryDemandResponseDto } from './forecast-category-demand.response.dto.js';
import { QueryLogisticsAnalyticsResponseDto } from './query-logistics-analytics.response.dto.js';

export type AiSelectedTool =
  | 'forecast_category_demand'
  | 'query_logistics_analytics';
export type AiVisualizationType = 'line' | 'bar' | 'table' | 'kpi';

export class AiVisualizationDto {
  @ApiProperty({ enum: ['line', 'bar', 'table', 'kpi'] })
  type!: AiVisualizationType;

  @ApiProperty()
  data!: unknown;
}

export class OrchestrateQuestionResponseDto {
  @ApiProperty({ example: 'Which carrier has the highest delay rate in Q2?' })
  question!: string;

  @ApiProperty({
    enum: ['forecast_category_demand', 'query_logistics_analytics'],
  })
  selectedTool!: AiSelectedTool;

  @ApiProperty()
  toolInput!: Record<string, unknown>;

  @ApiProperty({
    oneOf: [
      { $ref: '#/components/schemas/ForecastCategoryDemandResponseDto' },
      { $ref: '#/components/schemas/QueryLogisticsAnalyticsResponseDto' },
    ],
  })
  result!: ForecastCategoryDemandResponseDto | QueryLogisticsAnalyticsResponseDto;

  @ApiProperty({
    example: 'Top carrier by delay rate is Boreal at 66.7%.',
  })
  explanation!: string;

  @ApiProperty({ type: AiVisualizationDto })
  visualization!: AiVisualizationDto;
}
