import { ApiProperty } from '@nestjs/swagger';
import type { LogisticsOrder } from '../entities/logistics-order.entity.js';

export class LogisticsOrderItemDto {
  constructor(order: LogisticsOrder) {
    this.orderId = order.orderId;
    this.clientId = order.clientId;
    this.orderDate = order.orderDate;
    this.deliveryDate = order.deliveryDate;
    this.carrier = order.carrier;
    this.originCity = order.originCity;
    this.destinationCity = order.destinationCity;
    this.status = order.status;
    this.sku = order.sku;
    this.productCategory = order.productCategory;
    this.quantity = order.quantity;
    this.unitPriceUsd = order.unitPriceUsd;
    this.orderValueUsd = order.orderValueUsd;
    this.isPromo = order.isPromo;
    this.promoDiscountPct = order.promoDiscountPct;
    this.region = order.region;
    this.warehouse = order.warehouse;
  }

  @ApiProperty()
  orderId: string;

  @ApiProperty()
  clientId: string;

  @ApiProperty()
  orderDate: string;

  @ApiProperty()
  deliveryDate: string;

  @ApiProperty()
  carrier: string;

  @ApiProperty()
  originCity: string;

  @ApiProperty()
  destinationCity: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  sku: string;

  @ApiProperty()
  productCategory: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPriceUsd: number;

  @ApiProperty()
  orderValueUsd: number;

  @ApiProperty()
  isPromo: boolean;

  @ApiProperty()
  promoDiscountPct: number;

  @ApiProperty()
  region: string;

  @ApiProperty()
  warehouse: string;
}

export class LogisticsOrdersPaginationDto {
  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;
}

export class LogisticsOrdersResponseDto {
  @ApiProperty({ type: [LogisticsOrderItemDto] })
  items: LogisticsOrderItemDto[];

  @ApiProperty({ type: LogisticsOrdersPaginationDto })
  pagination: LogisticsOrdersPaginationDto;
}
