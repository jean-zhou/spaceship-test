import { ApiProperty } from '@nestjs/swagger';

export class LogisticsMonthlyOrderVolumeDto {
  @ApiProperty({ example: '2025-01' })
  month: string;

  @ApiProperty()
  orders: number;
}

export class LogisticsStatusMixDto {
  @ApiProperty()
  status: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  count: number;

  @ApiProperty()
  percentage: number;
}

export class LogisticsChartsResponseDto {
  @ApiProperty({ type: [LogisticsMonthlyOrderVolumeDto] })
  monthlyOrderVolume: LogisticsMonthlyOrderVolumeDto[];

  @ApiProperty({ type: [LogisticsStatusMixDto] })
  statusMix: LogisticsStatusMixDto[];
}
