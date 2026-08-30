import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export type ForecastMethod = 'moving_average' | 'linear_regression';

export class ForecastCategoryDemandRequestDto {
  @ApiProperty({
    example: 'PAPER',
    description: 'Product category to forecast.',
  })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiPropertyOptional({
    default: 4,
    minimum: 1,
    maximum: 6,
    description: 'Number of future months to forecast.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(6)
  months = 4;

  @ApiPropertyOptional({
    enum: ['moving_average', 'linear_regression'],
    default: 'moving_average',
    description: 'Basic forecasting method to use.',
  })
  @IsOptional()
  @IsIn(['moving_average', 'linear_regression'])
  method: ForecastMethod = 'moving_average';
}
