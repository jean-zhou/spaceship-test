import { ApiProperty } from '@nestjs/swagger';

export class LogisticsKpisResponseDto {
  @ApiProperty()
  totalOrders: number;

  @ApiProperty()
  deliveredOrders: number;

  @ApiProperty()
  delayedOrders: number;

  @ApiProperty()
  onTimeDeliveryRate: number;

  @ApiProperty({ nullable: true })
  averageDeliveryTimeDays: number | null;
}
