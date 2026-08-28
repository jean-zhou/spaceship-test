import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

const booleanIntegerTransformer = {
  to: (value: boolean) => (value ? 1 : 0),
  from: (value: number) => value === 1,
};

@Entity('logistics_orders')
@Unique('UQ_logistics_orders_order_id', ['orderId'])
export class LogisticsOrder {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('text', { name: 'client_id' })
  clientId!: string;

  @Column('text', { name: 'order_id' })
  orderId!: string;

  @Column('text', { name: 'order_date' })
  orderDate!: string;

  @Column('text', { name: 'delivery_date' })
  deliveryDate!: string;

  @Column('text')
  carrier!: string;

  @Column('text', { name: 'origin_city' })
  originCity!: string;

  @Column('text', { name: 'destination_city' })
  destinationCity!: string;

  @Column('text')
  status!: string;

  @Column('text')
  sku!: string;

  @Column('text', { name: 'product_category' })
  productCategory!: string;

  @Column('integer')
  quantity!: number;

  @Column('real', { name: 'unit_price_usd' })
  unitPriceUsd!: number;

  @Column('real', { name: 'order_value_usd' })
  orderValueUsd!: number;

  @Column('integer', {
    name: 'is_promo',
    transformer: booleanIntegerTransformer,
  })
  isPromo!: boolean;

  @Column('real', { name: 'promo_discount_pct' })
  promoDiscountPct!: number;

  @Column('text')
  region!: string;

  @Column('text')
  warehouse!: string;
}
