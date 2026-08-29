import { ApiProperty } from '@nestjs/swagger';

export class LogisticsFiltersResponseDto {
  @ApiProperty({ type: [String] })
  carriers: string[];

  @ApiProperty({ type: [String] })
  regions: string[];

  @ApiProperty({ type: [String] })
  statuses: string[];
}
